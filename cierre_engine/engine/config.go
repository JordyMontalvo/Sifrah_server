package engine

import (
	"strings"

	"sifrah/cierre_engine/models"
)

type RankDependency struct {
	Minimum    int    `json:"minimum"`
	DiffBranch bool   `json:"diff_branch"`
	RankName   string `json:"rank_name"`
}

type Rank struct {
	Pos               int              `json:"pos"`
	Rank              string           `json:"rank"`
	TypeCalculation   string           `json:"type_calculation"`
	MinimumFrontals   int              `json:"minimum_frontals"`
	ThresholdPoints   float64          `json:"threshold_points"`
	MaximumLargeLeg   float64          `json:"maximum_large_leg"`
	MaximumOthersLeg  float64          `json:"maximum_others_leg"`
	ReconsumoRequired float64          `json:"reconsumo_required"`
	RankDependencies  []RankDependency `json:"rank_dependencies"`
}

var Ranks = []Rank{
	{
		Pos:               10,
		Rank:              "EMBAJADOR SIFRAH",
		TypeCalculation:   "simple",
		MinimumFrontals:   6,
		ThresholdPoints:   600000,
		MaximumLargeLeg:   100000,
		MaximumOthersLeg:  100000,
		ReconsumoRequired: 160,
		RankDependencies:  []RankDependency{},
	},
	{
		Pos:               9,
		Rank:              "DIAMANTE IMPERIAL",
		TypeCalculation:   "simple",
		MinimumFrontals:   6,
		ThresholdPoints:   300000,
		MaximumLargeLeg:   55000,
		MaximumOthersLeg:  55000,
		ReconsumoRequired: 160,
		RankDependencies:  []RankDependency{},
	},
	{
		Pos:               8,
		Rank:              "TRIPLE DIAMANTE",
		TypeCalculation:   "simple",
		MinimumFrontals:   5,
		ThresholdPoints:   170000,
		MaximumLargeLeg:   37500,
		MaximumOthersLeg:  37500,
		ReconsumoRequired: 160,
		RankDependencies:  []RankDependency{},
	},
	{
		Pos:               7,
		Rank:              "DOBLE DIAMANTE",
		TypeCalculation:   "simple",
		MinimumFrontals:   5,
		ThresholdPoints:   85000,
		MaximumLargeLeg:   19000,
		MaximumOthersLeg:  19000,
		ReconsumoRequired: 160,
		RankDependencies:  []RankDependency{},
	},
	{
		Pos:               6,
		Rank:              "DIAMANTE",
		TypeCalculation:   "simple",
		MinimumFrontals:   4,
		ThresholdPoints:   45000,
		MaximumLargeLeg:   12000,
		MaximumOthersLeg:  12000,
		ReconsumoRequired: 160,
		RankDependencies:  []RankDependency{},
	},
	{
		Pos:               5,
		Rank:              "ESMERALDA",
		TypeCalculation:   "simple",
		MinimumFrontals:   4,
		ThresholdPoints:   20000,
		MaximumLargeLeg:   5500,
		MaximumOthersLeg:  5500,
		ReconsumoRequired: 160,
		RankDependencies:  []RankDependency{},
	},
	{
		Pos:               4,
		Rank:              "RUBÍ",
		TypeCalculation:   "simple",
		MinimumFrontals:   4,
		ThresholdPoints:   7500,
		MaximumLargeLeg:   2100,
		MaximumOthersLeg:  2100,
		ReconsumoRequired: 160,
		RankDependencies:  []RankDependency{},
	},
	{
		Pos:               3,
		Rank:              "ORO",
		TypeCalculation:   "simple",
		MinimumFrontals:   3,
		ThresholdPoints:   3500,
		MaximumLargeLeg:   1350,
		MaximumOthersLeg:  1350,
		ReconsumoRequired: 160,
		RankDependencies:  []RankDependency{},
	},
	{
		Pos:               2,
		Rank:              "PLATA",
		TypeCalculation:   "simple",
		MinimumFrontals:   3,
		ThresholdPoints:   1500,
		MaximumLargeLeg:   600,
		MaximumOthersLeg:  600,
		ReconsumoRequired: 160,
		RankDependencies:  []RankDependency{},
	},
	{
		Pos:               1,
		Rank:              "BRONCE",
		TypeCalculation:   "simple",
		MinimumFrontals:   2,
		ThresholdPoints:   500,
		MaximumLargeLeg:   300,
		MaximumOthersLeg:  300,
		ReconsumoRequired: 160,
		RankDependencies:  []RankDependency{},
	},
	{
		Pos:               0,
		Rank:              "ACTIVO",
		TypeCalculation:   "simple",
		MinimumFrontals:   0,
		ThresholdPoints:   1,
		MaximumLargeLeg:   0,
		MaximumOthersLeg:  0,
		ReconsumoRequired: 120,
		RankDependencies:  []RankDependency{},
	},
}

// ResidualPercentagesByRank — Bono regalías (N1–N9 como fracción 1.0 = 100%).
// Alineado con tabla oficial SIFRAH: ACTIVO 2 niveles; BRONCE 4 (último 5%); PLATA 5; ORO 6;
// RUBÍ 7; ESMERALDA/DIAMANTE/DOBLE/TRIPLE/IMPERIAL 9; tope = EMBAJADOR SIFRAH (tabla “DIAMANTE CORONA”, N9 5%).
var ResidualPercentagesByRank = map[string][]float64{
	"ACTIVO":           {0.15, 0.15, 0, 0, 0, 0, 0, 0, 0},
	"BRONCE":           {0.15, 0.15, 0.15, 0.05, 0, 0, 0, 0, 0},
	"PLATA":            {0.15, 0.15, 0.15, 0.10, 0.05, 0, 0, 0, 0},
	"ORO":              {0.15, 0.15, 0.15, 0.15, 0.05, 0.05, 0, 0, 0},
	"RUBÍ":             {0.15, 0.15, 0.15, 0.15, 0.10, 0.05, 0.025, 0, 0},
	"ESMERALDA":        {0.15, 0.15, 0.15, 0.15, 0.10, 0.05, 0.025, 0.025, 0.01},
	"DIAMANTE":         {0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.025, 0.025, 0.01},
	"DOBLE DIAMANTE":   {0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.05, 0.025, 0.01},
	"TRIPLE DIAMANTE":  {0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.05, 0.025, 0.025},
	"DIAMANTE IMPERIAL": {0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.05, 0.05, 0.025},
	"EMBAJADOR SIFRAH": {0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.05, 0.05, 0.05},
	// Mismo plan que EMBAJADOR SIFRAH (nombre en material comercial “DIAMANTE CORONA”).
	"DIAMANTE CORONA": {0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.05, 0.05, 0.05},
}

var MaxDepthByRank = map[string]int{
	"none":              0,
	"ACTIVO":            2,
	"BRONCE":            4, // exactamente 4 niveles (alineado con los 4 % > 0 en ResidualPercentagesByRank)
	"PLATA":             5,
	"ORO":               6,
	"RUBÍ":              7,
	"ESMERALDA":         9,
	"DIAMANTE":          9,
	"DOBLE DIAMANTE":    9,
	"TRIPLE DIAMANTE":   9,
	"DIAMANTE IMPERIAL": 9,
	"EMBAJADOR SIFRAH":  9,
	"DIAMANTE CORONA":   9,
}

var RankAchievementBonuses = []models.Pay{
	{Name: "BRONCE", Value: 60},
	{Name: "PLATA", Value: 300},
	{Name: "ORO", Value: 600},
	{Name: "RUBÍ", Value: 1200},
	{Name: "ESMERALDA", Value: 2500},
	{Name: "DIAMANTE", Value: 5000},
	{Name: "DOBLE DIAMANTE", Value: 10000},
	{Name: "TRIPLE DIAMANTE", Value: 20000},
	{Name: "DIAMANTE IMPERIAL", Value: 40000},
	{Name: "EMBAJADOR SIFRAH", Value: 80000},
}

const (
	TopePuntos       = 160.0
	ReduccionExceso = 0.6
)

// NormalizeRankKeyForResidual alinea el string de Mongo con las claves de los mapas (mayúsculas, RUBÍ).
func NormalizeRankKeyForResidual(rank string) string {
	r := strings.TrimSpace(rank)
	if r == "" || strings.EqualFold(r, "none") {
		return ""
	}
	if strings.EqualFold(r, "RUBI") {
		return "RUBÍ"
	}
	// Tabla comercial “DIAMANTE CORONA” = mismo residual que EMBAJADOR SIFRAH en motor.
	if strings.EqualFold(r, "DIAMANTE CORONA") {
		return "DIAMANTE CORONA"
	}
	if _, ok := MaxDepthByRank[r]; ok {
		return r
	}
	u := strings.ToUpper(r)
	if _, ok := MaxDepthByRank[u]; ok {
		return u
	}
	if _, ok := ResidualPercentagesByRank[r]; ok {
		return r
	}
	if _, ok := ResidualPercentagesByRank[u]; ok {
		return u
	}
	return ""
}

// ResidualMaxDepth niveles máximos de pago residual: el menor entre el tope del rango y los niveles con % > 0.
// BRONCE: 4 niveles (15%, 15%, 15%, 5%); no puede exceder aunque un mapa esté desalineado.
func ResidualMaxDepth(rank string) int {
	key := NormalizeRankKeyForResidual(rank)
	if key == "" {
		return 0
	}
	maxD, ok := MaxDepthByRank[key]
	if !ok {
		return 0
	}
	pcts, ok := ResidualPercentagesByRank[key]
	if !ok || len(pcts) == 0 {
		return 0
	}
	lastPay := 0
	for i, p := range pcts {
		if p > 0 {
			lastPay = i + 1
		}
	}
	if lastPay == 0 {
		return 0
	}
	if maxD < lastPay {
		return maxD
	}
	return lastPay
}
