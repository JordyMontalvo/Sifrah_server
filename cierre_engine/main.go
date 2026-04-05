package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"sifrah/cierre_engine/db"
	"sifrah/cierre_engine/engine"
	"sifrah/cierre_engine/models"

	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/v2/bson"
)

// VirtualBalanceResetPreview — saldo virtual (no disponible) que se quita con transacción "closed reset".
type VirtualBalanceResetPreview struct {
	ID     string  `json:"id"`
	Name   string  `json:"name"`
	DNI    string  `json:"dni"`
	Amount float64 `json:"amount"`
}

type PreviewResult struct {
	Tree           []PreviewNode                 `json:"tree"`
	VirtualResets  []VirtualBalanceResetPreview  `json:"virtual_resets"`
	Affiliations   []models.Transaction          `json:"affiliations"` // Placeholder for compatibility
	Activations    []models.Transaction          `json:"activations"`  // Placeholder
}

type PreviewNode struct {
	ID             string                   `json:"id"`
	Name           string                   `json:"name"`
	Points         float64                  `json:"points"`
	Total          float64                  `json:"_total"`
	Rank           string                   `json:"rank"`
	ResidualBonus  float64                  `json:"residual_bonus"`
	ResidualLines  []models.ResidualLineEntry `json:"residual_lines,omitempty"`
	Activated      bool                     `json:"activated"`
	ActivatedInt   bool                     `json:"_activated"`
	Pays           []models.Pay             `json:"_pays"`
}

func residualLinesFromTxs(txs []models.Transaction) []models.ResidualLineEntry {
	if len(txs) == 0 {
		return nil
	}
	out := make([]models.ResidualLineEntry, 0, len(txs))
	for _, tx := range txs {
		out = append(out, models.ResidualLineEntry{
			FromUserID: tx.FromUserID,
			Name:       tx.AffiliateName,
			DNI:        tx.AffiliateDNI,
			Level:      tx.Level,
			PR:         tx.PR,
			Percentage: tx.Percentage,
			Amount:     tx.Value,
		})
	}
	return out
}

func main() {
	start := time.Now()

	dryRun := flag.Bool("dry-run", false, "Do not write results to MongoDB")
	jsonOutput := flag.Bool("json", false, "Output results in JSON format")
	flag.Parse()

	if !*jsonOutput {
		if *dryRun {
			log.Println("⚡ RUNNING IN DRY-RUN MODE (No changes will be saved)")
		}
	} else {
		// Silence regular logs if JSON is requested to stdout
		log.SetOutput(os.Stderr)
	}

	// Try multiple paths for .env
	envPaths := []string{"../db/.env", "./db/.env", ".env"}
	for _, p := range envPaths {
		if err := godotenv.Load(p); err == nil {
			if !*jsonOutput {
				log.Printf("Loaded environment from %s", p)
			}
			break
		}
	}

	uri := os.Getenv("DB_URL_DEV")
	dbName := os.Getenv("DB_NAME_DEV")

	if uri == "" {
		uri = os.Getenv("DB_URL_PROD")
		dbName = os.Getenv("DB_NAME_PROD")
	}

	if uri == "" {
		log.Fatal("Could not find DB_URL_DEV or DB_URL_PROD in environment")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()

	if !*jsonOutput {
		log.Printf("Connecting to MongoDB at %s (DB: %s)...", uri, dbName)
	}
	m, err := db.Connect(ctx, uri, dbName)
	if err != nil {
		log.Fatal(err)
	}

	// 1. Load Data
	users, err := m.GetUsers(ctx)
	if err != nil {
		log.Fatal(err)
	}
	treeNodes, err := m.GetTree(ctx)
	if err != nil {
		log.Fatal(err)
	}
	virtualTxs, err := m.GetVirtualTransactions(ctx)
	if err != nil {
		log.Fatal(err)
	}

	if !*jsonOutput {
		log.Printf("Loaded %d users, %d tree nodes, %d virtual transactions", len(users), len(treeNodes), len(virtualTxs))
	}

	// 2. Integration: transactions.js logic (Closed Reset)
	txByUserID := make(map[string]float64)
	for _, tx := range virtualTxs {
		if tx.Type == "in" {
			txByUserID[tx.UserID] += tx.Value
		} else if tx.Type == "out" {
			txByUserID[tx.UserID] -= tx.Value
		}
	}

	var resetTransactions []models.Transaction
	for _, user := range users {
		balance := txByUserID[user.ID]
		if balance > 0 {
			resetTransactions = append(resetTransactions, models.Transaction{
				UserID:  user.ID,
				Type:    "out",
				Value:   balance,
				Name:    "closed reset",
				Desc:    "Reset de balance al cierre",
				Date:    time.Now(),
				Virtual: true,
			})
		}
	}

	userByID := make(map[string]*models.User)
	for i := range users {
		userByID[users[i].ID] = &users[i]
	}
	var virtualResets []VirtualBalanceResetPreview
	for _, rt := range resetTransactions {
		u := userByID[rt.UserID]
		nm := ""
		dni := ""
		if u != nil {
			nm = u.Name + " " + u.LastName
			dni = u.DNI
		}
		virtualResets = append(virtualResets, VirtualBalanceResetPreview{
			ID: rt.UserID, Name: nm, DNI: dni, Amount: rt.Value,
		})
	}

	// 3. Initialize Engine and Logger
	var cl *engine.CierreLogger
	if !*jsonOutput {
		cl, err = engine.NewCierreLogger()
		if err != nil {
			log.Printf("Warning: Could not create log files: %v", err)
		} else {
			defer cl.Close()
		}
	}

	ce := engine.NewCierreEngine(users, treeNodes, cl)
	for i := range users {
		_ = ce.CalculateTotalPoints(users[i].ID)
	}
	legsByUserID := make(map[string][]models.LegDetail)

	// 4. Calculation Phase
	var updatedUsers []models.User
	var totalBonusTransactions []models.Transaction
	var previewNodes []PreviewNode

	for i := range users {
		user := &users[i]
		
		// A. Rank
		rank := ce.CalculateRank(user.ID)
		calculatedTotalPoints := ce.MemoPoints[user.ID]

		// B. Residual Bonus
		resTxs, resTotal := ce.CalculateResidualBonus(user.ID)
		for j := range resTxs {
			resTxs[j].UserID = user.ID
			resTxs[j].Date = time.Now()
		}
		totalBonusTransactions = append(totalBonusTransactions, resTxs...)
		resLines := residualLinesFromTxs(resTxs)

		// Collect preview data BEFORE resetting
		if rank != "none" || calculatedTotalPoints > 0 || resTotal > 0 {
			previewNodes = append(previewNodes, PreviewNode{
				ID:             user.ID,
				Name:           user.Name + " " + user.LastName,
				Points:         user.Points,
				Total:          calculatedTotalPoints,
				Rank:           rank,
				ResidualBonus:  resTotal,
				ResidualLines:  resLines,
				Activated:      user.Activated,
				ActivatedInt:   user.ActivatedInternal,
				Pays:           []models.Pay{}, // Can be populated if needed
			})
		}

		// Save grouped points by leg for closed history (same logic as preview)
		if node, ok := ce.TreeNodes[user.ID]; ok {
			var legs []models.LegDetail
			for idx, childID := range node.Childs {
				child, childOk := ce.Users[childID]
				if !childOk {
					continue
				}
				totalByLeg, hasMemo := ce.MemoPoints[childID]
				if !hasMemo {
					totalByLeg = ce.CalculateTotalPoints(childID)
				}
				legs = append(legs, models.LegDetail{
					Idx:         idx + 1,
					UserID:      childID,
					Name:        child.Name + " " + child.LastName,
					DNI:         child.DNI,
					TotalPoints: totalByLeg,
				})
			}
			legsByUserID[user.ID] = legs
		}

		// Store for history BEFORE resetting
		user.LastTotalPoints   = calculatedTotalPoints
		user.LastResidualBonus = resTotal

		// Update for DB (cycle reset as per users.js)
		user.Rank              = rank
		user.TotalPoints       = 0
		user.Points            = 0
		user.AffiliationPoints = 0
		user.Activated         = false
		user.ActivatedInternal = false

		updatedUsers = append(updatedUsers, *user)
	}

	if *jsonOutput {
		res := PreviewResult{
			Tree:          previewNodes,
			VirtualResets: virtualResets,
			Affiliations:  []models.Transaction{},
			Activations:   []models.Transaction{},
		}
		json.NewEncoder(os.Stdout).Encode(res)
		return
	}

	// Build users summary for closed history
	var usersSummary []models.ClosedUserEntry
	for _, u := range updatedUsers {
		if u.Rank != "none" && u.Rank != "" {
			var resLines []models.ResidualLineEntry
			for _, tx := range totalBonusTransactions {
				if tx.UserID == u.ID && tx.Name == "residual bonus" {
					resLines = append(resLines, models.ResidualLineEntry{
						FromUserID: tx.FromUserID,
						Name:       tx.AffiliateName,
						DNI:        tx.AffiliateDNI,
						Level:      tx.Level,
						PR:         tx.PR,
						Percentage: tx.Percentage,
						Amount:     tx.Value,
					})
				}
			}
			usersSummary = append(usersSummary, models.ClosedUserEntry{
				UserID:            u.ID,
				Name:              u.Name + " " + u.LastName,
				Rank:              u.Rank,
				Points:            u.LastTotalPoints,
				TotalPoints:       u.LastTotalPoints,
				ResidualBonus:     u.LastResidualBonus,
				ResidualLines:     resLines,
				GroupedPointsLegs: legsByUserID[u.ID],
			})
		}
	}

	// 6. Persistence Phase
	if *dryRun {
		log.Println("DRY-RUN: Skipping database updates")
	} else {
		allTxs := append(resetTransactions, totalBonusTransactions...)
		log.Printf("Saving %d transactions...", len(allTxs))
		m.SaveTransactions(ctx, allTxs)

		log.Printf("Updating %d users...", len(updatedUsers))
		m.UpdateUserRanks(ctx, updatedUsers)
	}

	// 7. Final Logging
	var resetDetail []bson.M
	for _, vr := range virtualResets {
		resetDetail = append(resetDetail, bson.M{
			"user_id": vr.ID,
			"name":    vr.Name,
			"dni":     vr.DNI,
			"amount":  vr.Amount,
		})
	}
	summary := bson.M{
		"users_processed":          len(users),
		"reset_transactions":     len(resetTransactions),
		"bonus_transactions":     len(totalBonusTransactions),
		"duration_ms":            time.Since(start).Milliseconds(),
		"timestamp":              time.Now(),
		"dry_run":                *dryRun,
		"virtual_balance_resets": resetDetail,
	}

	if !*dryRun {
		m.LogClosed(ctx, summary, usersSummary)
	}

	fmt.Printf("\nSUCCESS: Period closed in %v\n", time.Since(start))
	fmt.Printf("Summary: %+v\n", summary)
}
