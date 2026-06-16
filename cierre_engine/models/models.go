package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type Pay struct {
	Name  string  `bson:"name" json:"name"`
	Paid  bool    `bson:"payed" json:"payed"`
	Value float64 `bson:"value" json:"value"`
}

type User struct {
	ID                string    `bson:"id" json:"id"`
	DNI               string    `bson:"dni" json:"dni"`
	Name              string    `bson:"name" json:"name"`
	LastName          string    `bson:"lastName" json:"lastName"`
	ParentID          string    `bson:"parentId" json:"parentId"`
	Plan              string    `bson:"plan" json:"plan"`
	Email             string    `bson:"email" json:"email"`
	Phone             string    `bson:"phone" json:"phone"`
	Status            string    `bson:"status" json:"status"`
	StatusReason      string    `bson:"statusReason" json:"statusReason"`
	NInactives        int       `bson:"n_inactives" json:"n_inactives"`
	Points            float64   `bson:"points" json:"points"`
	AffiliationPoints float64   `bson:"affiliation_points" json:"affiliation_points"`
	Activated         bool      `bson:"activated" json:"activated"`
	Rank              string    `bson:"rank" json:"rank"`
	TotalPoints       float64   `bson:"total_points" json:"total_points"`
	Pays              []Pay     `bson:"pays" json:"pays"`
	Affiliated        bool      `bson:"affiliated" json:"affiliated"`
	ActivatedInternal bool      `bson:"_activated" json:"_activated"`
	AffiliationDate   time.Time `bson:"affiliation_date" json:"affiliation_date"`
	// Computed fields (not persisted directly, used for history entry)
	LastResidualBonus     float64   `bson:"-" json:"-"`
	LastGenerationalBonus float64   `bson:"-" json:"-"`
	LastSavingsBonus      float64   `bson:"-" json:"-"`
	LastTotalPoints       float64   `bson:"-" json:"-"`
	LastPoints            float64   `bson:"-" json:"-"`
	LastActivated         bool      `bson:"-" json:"-"`
	LastActivatedInt      bool      `bson:"-" json:"-"`
}

type TreeNode struct {
	ID                string    `bson:"id" json:"id"`
	Parent            string    `bson:"parent" json:"parent"`
	ParentID          string    `bson:"parentId" json:"parentId"`
	Childs            []string  `bson:"childs" json:"childs"`
}

type Transaction struct {
	ID                 string    `bson:"id" json:"id"`
	UserID             string    `bson:"user_id" json:"user_id"`
	FromUserID         string    `bson:"from_user_id,omitempty" json:"from_user_id,omitempty"`
	Type               string    `bson:"type" json:"type"` // "in", "out"
	Value              float64   `bson:"value" json:"value"`
	Name               string    `bson:"name" json:"name"`
	Desc               string    `bson:"desc" json:"desc"`
	Date               time.Time `bson:"date" json:"date"`
	Virtual            bool      `bson:"virtual" json:"virtual"`
	Level              int       `bson:"level,omitempty" json:"level,omitempty"`
	AffiliateName      string    `bson:"affiliate_name,omitempty" json:"affiliate_name,omitempty"`
	AffiliateDNI       string    `bson:"affiliate_dni,omitempty" json:"affiliate_dni,omitempty"`
	PR                 float64   `bson:"pr,omitempty" json:"pr,omitempty"`
	Percentage         float64   `bson:"percentage,omitempty" json:"percentage,omitempty"`
	WalletType         string    `bson:"wallet_tipo,omitempty" json:"wallet_tipo,omitempty"`
}

type LegDetail struct {
	Idx         int     `bson:"idx" json:"idx"`
	UserID      string  `bson:"user_id" json:"user_id"`
	Name        string  `bson:"name" json:"name"`
	DNI         string  `bson:"dni" json:"dni"`
	TotalPoints float64 `bson:"total_points" json:"total_points"`
}

// SnapshotNode — Representación recursiva de la red en el momento del cierre.
type SnapshotNode struct {
	UserID      string          `bson:"user_id" json:"id"`
	Name        string          `bson:"name" json:"name"`
	DNI         string          `bson:"dni,omitempty" json:"dni,omitempty"`
	Rank        string          `bson:"rank" json:"rank"`
	Points      float64         `bson:"points" json:"points"`
	TotalPoints float64         `bson:"total_points" json:"_total"`
	Childs      []*SnapshotNode `bson:"childs,omitempty" json:"childs,omitempty"`
}

// ResidualLineEntry — una línea de bono residual (origen: puntos de reconsumo de un downline).
type ResidualLineEntry struct {
	FromUserID string  `bson:"from_user_id,omitempty" json:"from_user_id,omitempty"`
	Name       string  `bson:"name,omitempty" json:"name,omitempty"`
	DNI        string  `bson:"dni,omitempty" json:"dni,omitempty"`
	Level      int     `bson:"level,omitempty" json:"level,omitempty"`
	PR         float64 `bson:"pr,omitempty" json:"pr,omitempty"`
	Percentage float64 `bson:"percentage,omitempty" json:"percentage,omitempty"`
	Amount     float64 `bson:"amount,omitempty" json:"amount,omitempty"`
}

// GenerationalLineEntry — una línea de bono generacional VIP.
type GenerationalLineEntry struct {
	FromUserID string  `bson:"from_user_id,omitempty" json:"from_user_id,omitempty"`
	Name       string  `bson:"name,omitempty" json:"name,omitempty"`
	DNI        string  `bson:"dni,omitempty" json:"dni,omitempty"`
	Generation int     `bson:"generation,omitempty" json:"generation,omitempty"`
	PR         float64 `bson:"pr,omitempty" json:"pr,omitempty"`
	Percentage float64 `bson:"percentage,omitempty" json:"percentage,omitempty"`
	Amount     float64 `bson:"amount,omitempty" json:"amount,omitempty"`
}

type ClosedUserEntry struct {
	UserID            string              `bson:"user_id" json:"id"`
	Name              string              `bson:"name" json:"name"`
	DNI               string              `bson:"dni,omitempty" json:"dni,omitempty"`
	Rank              string              `bson:"rank" json:"rank"`
	Points            float64             `bson:"points" json:"points"`
	TotalPoints       float64             `bson:"total_points" json:"_total"`
	Activated         bool                `bson:"activated" json:"activated"`
	ActivatedInt      bool                `bson:"_activated" json:"_activated"`
	ResidualBonus     float64                 `bson:"residual_bonus" json:"residual_bonus"`
	ResidualLines     []ResidualLineEntry     `bson:"residual_lines,omitempty" json:"residual_lines,omitempty"`
	GenerationalBonus float64                 `bson:"generational_bonus" json:"generational_bonus"`
	GenerationalLines []GenerationalLineEntry `bson:"generational_lines,omitempty" json:"generational_lines,omitempty"`
	SavingsBonus      float64                 `bson:"savings_bonus,omitempty" json:"savings_bonus,omitempty"`
	GroupedPointsLegs []LegDetail             `bson:"grouped_points_legs,omitempty" json:"grouped_points_legs,omitempty"`
	TreeSnapshot      *SnapshotNode           `bson:"tree_snapshot,omitempty" json:"tree_snapshot,omitempty"`
}

type Closed struct {
	ID    string    `bson:"id" json:"id"`
	Date  time.Time `bson:"date" json:"date"`
	Data  bson.M    `bson:"data" json:"data"`
}
