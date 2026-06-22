#!/bin/bash
sed -i '' -e '/LastPoints            float64   `bson:"-" json:"-"`/a\
	LastAffiliationPoints float64   `bson:"-" json:"-"`\
	LastPersonalPoints    float64   `bson:"-" json:"-"`' cierre_engine/models/models.go

sed -i '' -e '/Points      float64         `bson:"points" json:"points"`/a\
	ReconsumoPoints   float64         `bson:"reconsumo_points" json:"reconsumo_points"`\
	AffiliationPoints float64         `bson:"affiliation_points" json:"affiliation_points"`\
	PersonalPoints    float64         `bson:"personal_points" json:"personal_points"`' cierre_engine/models/models.go

sed -i '' -e '/Points            float64             `bson:"points" json:"points"`/a\
	ReconsumoPoints   float64             `bson:"reconsumo_points" json:"reconsumo_points"`\
	AffiliationPoints float64             `bson:"affiliation_points" json:"affiliation_points"`\
	PersonalPoints    float64             `bson:"personal_points" json:"personal_points"`' cierre_engine/models/models.go
