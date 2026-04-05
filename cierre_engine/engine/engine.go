package engine

import (
	"fmt"
	"math"
	"sort"
	"sifrah/cierre_engine/models"
)

type CierreEngine struct {
	Users      map[string]*models.User
	TreeNodes  map[string]*models.TreeNode
	MemoPoints map[string]float64
	Logger     *CierreLogger
}

func NewCierreEngine(users []models.User, treeNodes []models.TreeNode, logger *CierreLogger) *CierreEngine {
	userMap := make(map[string]*models.User)
	for i := range users {
		userMap[users[i].ID] = &users[i]
	}

	treeMap := make(map[string]*models.TreeNode)
	for i := range treeNodes {
		treeMap[treeNodes[i].ID] = &treeNodes[i]
	}

	return &CierreEngine{
		Users:      userMap,
		TreeNodes:  treeMap,
		MemoPoints: make(map[string]float64),
		Logger:     logger,
	}
}

// CalculateTotalPoints calculates the raw points (personal + children) for a node
func (e *CierreEngine) CalculateTotalPoints(id string) float64 {
	if val, ok := e.MemoPoints[id]; ok {
		return val
	}

	user, ok := e.Users[id]
	if !ok {
		return 0
	}

	total := user.Points + user.AffiliationPoints

	treeNode, ok := e.TreeNodes[id]
	if ok {
		for _, childID := range treeNode.Childs {
			total += e.CalculateTotalPoints(childID)
		}
	}

	e.MemoPoints[id] = total
	return total
}

func (e *CierreEngine) GetActiveLines(id string) int {
	treeNode, ok := e.TreeNodes[id]
	if !ok {
		return 0
	}

	count := 0
	for _, childID := range treeNode.Childs {
		childPoints := e.CalculateTotalPoints(childID)
		if childPoints > 0 {
			count++
		}
	}
	return count
}

func (e *CierreEngine) CalculateRank(id string) string {
	user, ok := e.Users[id]
	if !ok || !user.Activated {
		return "none"
	}

	treeNode, ok := e.TreeNodes[id]
	if !ok {
		return "ACTIVO"
	}

	// Prepare legs for VMP calculation
	var legs []float64
	for _, childID := range treeNode.Childs {
		p := e.CalculateTotalPoints(childID)
		if p > 0 {
			legs = append(legs, p)
		}
	}
	sort.Slice(legs, func(i, j int) bool {
		return legs[i] > legs[j]
	})

	if e.Logger != nil {
		e.Logger.LogRank("DEBUG PUNTOS - %s %s : total_points (RAW)=%.2f, piernas=%v", user.Name, user.LastName, user.Points+user.AffiliationPoints, legs)
	}

	activeLines := len(legs)
	reconsumo := math.Max(user.Points, user.AffiliationPoints) // As seen in js: Math.max(Number(user.points), Number(user.affiliation_points))

	// Evaluate ranks from highest to lowest
	for _, r := range Ranks {
		if r.TypeCalculation != "simple" {
			continue
		}

		// 1. Check Reconsumo
		if reconsumo < r.ReconsumoRequired {
			continue
		}

		// 2. Check Active Lines
		if activeLines < r.MinimumFrontals {
			continue
		}

		// 3. Truncate legs with VMP
		totalWithVMP := 0.0
		puntosPersonales := user.Points + user.AffiliationPoints

		// Work with a copy of legs
		calcLegs := make([]float64, len(legs))
		copy(calcLegs, legs)

		if len(calcLegs) > 0 {
			calcLegs[len(calcLegs)-1] += puntosPersonales
		} else {
			totalWithVMP = puntosPersonales
			if r.MaximumLargeLeg > 0 && totalWithVMP > r.MaximumLargeLeg {
				totalWithVMP = r.MaximumLargeLeg
			}
		}

		if len(calcLegs) > 0 {
			vmp := r.MaximumLargeLeg
			for _, legVal := range calcLegs {
				if vmp > 0 && legVal > vmp {
					totalWithVMP += vmp
				} else {
					totalWithVMP += legVal
				}
			}
		}

		if totalWithVMP >= r.ThresholdPoints {
			if e.Logger != nil {
				e.Logger.LogRank(" ✅ RANGO ALCANZADO: %s para %s %s (Points with VMP: %.2f)", r.Rank, user.Name, user.LastName, totalWithVMP)
			}
			// Update user total points for DB save
			user.TotalPoints = totalWithVMP
			return r.Rank
		}
	}

	return "ACTIVO"
}

// closedRank es el rango calculado en ESTE cierre (CalculateRank). El residual debe usar ese rango,
// no user.Rank de la BD: si alguien cierra BRONCE pero en BD seguía PLATA, antes se pagaban 5 niveles por error.
func (e *CierreEngine) CalculateResidualBonus(id string, closedRank string) ([]models.Transaction, float64) {
	user, ok := e.Users[id]
	if !ok {
		return nil, 0
	}
	if closedRank == "none" || closedRank == "" {
		return nil, 0
	}

	normRank := NormalizeRankKeyForResidual(closedRank)
	if e.Logger != nil {
		e.Logger.LogResidual("📊 %s %s (rango cierre=%q → residual %q; rank BD=%q)", user.Name, user.LastName, closedRank, normRank, user.Rank)
	}

	maxDepth := ResidualMaxDepth(normRank)
	percentages := ResidualPercentagesByRank[normRank]

	if maxDepth == 0 || len(percentages) == 0 {
		return nil, 0
	}

	var results []models.Transaction
	var total float64

	// Recursive helper for compression logic
	var collect func(nodeID string, currentEffectiveLevel int)
	collect = func(nodeID string, currentEffectiveLevel int) {
		if currentEffectiveLevel >= maxDepth {
			return
		}

		node, ok := e.TreeNodes[nodeID]
		if !ok {
			return
		}

		for _, childID := range node.Childs {
			child, childOk := e.Users[childID]
			if !childOk {
				continue
			}

			pr := child.Points // Reconsumption points only
			if pr > 0 {
				nextLevel := currentEffectiveLevel + 1
				// No pagar ni bajar por esta pierna si ya se superó el tope del rango (p. ej. BRONCE = 4 niveles).
				if nextLevel > maxDepth {
					continue
				}
				if nextLevel > len(percentages) {
					continue
				}
				pct := percentages[nextLevel-1]
				if pct > 0 {
					bonus := 0.0
					if pr <= TopePuntos {
						bonus = pr * pct
					} else {
						bonus = (TopePuntos * pct) + ((pr - TopePuntos) * (pct * ReduccionExceso))
					}

					if bonus > 0 {
						if e.Logger != nil {
							e.Logger.LogResidual("   Nivel %d: %s %s (PR: %.2f) → %.2f", nextLevel, child.Name, child.LastName, pr, bonus)
						}
						total += bonus
						results = append(results, models.Transaction{
							Type:          "in",
							Value:         bonus,
							Name:          "residual bonus",
							Desc:          fmt.Sprintf("Bono residual nivel %d - %s %s", nextLevel, child.Name, child.LastName),
							FromUserID:    child.ID,
							Level:         nextLevel,
							AffiliateName: child.Name + " " + child.LastName,
							AffiliateDNI:  child.DNI,
							PR:            pr,
							Percentage:    pct,
						})
					}
				}
				collect(childID, nextLevel)
			} else {
				// Compression: skip this level, pass current level down
				collect(childID, currentEffectiveLevel)
			}
		}
	}

	collect(id, 0)
	if e.Logger != nil && total > 0 {
		e.Logger.LogResidual("   💰 Total bono residual: %.2f", total)
	}
	return results, total
}

func (e *CierreEngine) CalculateExcedentBonus(id string) []models.Transaction {
	user, ok := e.Users[id]
	if !ok {
		return nil
	}

	var txs []models.Transaction

	// Excedent bonus logic: 10% to sponsor, 20% to self if > 150 points
	// Node.js logic:
	// const excedent = node.points - 150
	// if(excedent > 0) { ... }
	
	excedent := user.Points - 150
	if excedent <= 0 {
		return nil
	}

	// 20% to self
	if user.Activated {
		val := excedent * 0.20
		txs = append(txs, models.Transaction{
			UserID: user.ID,
			Type:   "in",
			Value:  val,
			Name:   "excedent bonus",
			Desc:   "Bono excedente personal",
		})
	}

	// 10% to sponsor
	if user.ParentID != "" {
		parent, ok := e.Users[user.ParentID]
		if ok && parent.Activated {
			val := excedent * 0.10
			txs = append(txs, models.Transaction{
				UserID:     parent.ID,
				FromUserID: user.ID,
				Type:       "in",
				Value:      val,
				Name:       "excedent bonus",
				Desc:       fmt.Sprintf("Bono excedente de %s %s", user.Name, user.LastName),
			})
		}
	}

	return txs
}
