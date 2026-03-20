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

type PreviewResult struct {
	Tree         []PreviewNode        `json:"tree"`
	Affiliations []models.Transaction `json:"affiliations"` // Placeholder for compatibility
	Activations  []models.Transaction `json:"activations"`  // Placeholder
}

type PreviewNode struct {
	ID             string       `json:"id"`
	Name           string       `json:"name"`
	Points         float64      `json:"points"`
	Total          float64      `json:"_total"`
	Rank           string       `json:"rank"`
	ResidualBonus  float64      `json:"residual_bonus"`
	Activated      bool         `json:"activated"`
	ActivatedInt   bool         `json:"_activated"`
	Pays           []models.Pay `json:"_pays"`
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

		// Collect preview data BEFORE resetting
		if rank != "none" || calculatedTotalPoints > 0 || resTotal > 0 {
			previewNodes = append(previewNodes, PreviewNode{
				ID:             user.ID,
				Name:           user.Name + " " + user.LastName,
				Points:         user.Points,
				Total:          calculatedTotalPoints,
				Rank:           rank,
				ResidualBonus:  resTotal,
				Activated:      user.Activated,
				ActivatedInt:   user.ActivatedInternal,
				Pays:           []models.Pay{}, // Can be populated if needed
			})
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
			Tree:         previewNodes,
			Affiliations: []models.Transaction{},
			Activations:  []models.Transaction{},
		}
		json.NewEncoder(os.Stdout).Encode(res)
		return
	}

	// Build users summary for closed history
	var usersSummary []models.ClosedUserEntry
	for _, u := range updatedUsers {
		if u.Rank != "none" && u.Rank != "" {
			usersSummary = append(usersSummary, models.ClosedUserEntry{
				UserID:        u.ID,
				Name:          u.Name + " " + u.LastName,
				Rank:          u.Rank,
				Points:        u.LastTotalPoints,
				TotalPoints:   u.LastTotalPoints,
				ResidualBonus: u.LastResidualBonus,
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
	summary := bson.M{
		"users_processed":    len(users),
		"reset_transactions": len(resetTransactions),
		"bonus_transactions": len(totalBonusTransactions),
		"duration_ms":        time.Since(start).Milliseconds(),
		"timestamp":          time.Now(),
		"dry_run":            *dryRun,
	}

	if !*dryRun {
		m.LogClosed(ctx, summary, usersSummary)
	}

	fmt.Printf("\nSUCCESS: Period closed in %v\n", time.Since(start))
	fmt.Printf("Summary: %+v\n", summary)
}
