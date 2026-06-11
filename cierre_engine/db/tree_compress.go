package db

import (
	"context"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// CompressTreeOnElimination quita al usuario del padre y sube sus hijos
// a la misma posición en childs (sin huecos).
func (db *MongoDB) CompressTreeOnElimination(ctx context.Context, userID string) error {
	var node struct {
		ID     string   `bson:"id"`
		Parent string   `bson:"parent"`
		Childs []string `bson:"childs"`
	}
	err := db.DB.Collection("tree").FindOne(ctx, bson.M{"id": userID}).Decode(&node)
	if err != nil {
		return nil
	}

	childIDs := make([]string, 0, len(node.Childs))
	for _, c := range node.Childs {
		if c != "" {
			childIDs = append(childIDs, c)
		}
	}

	parentID := node.Parent

	if parentID != "" {
		var parentNode struct {
			ID     string   `bson:"id"`
			Childs []string `bson:"childs"`
		}
		if err := db.DB.Collection("tree").FindOne(ctx, bson.M{"id": parentID}).Decode(&parentNode); err == nil {
			parentChilds := parentNode.Childs
			idx := -1
			for i, c := range parentChilds {
				if c == userID {
					idx = i
					break
				}
			}
			updated := make([]string, 0, len(parentChilds)+len(childIDs))
			for _, c := range parentChilds {
				if c != userID {
					updated = append(updated, c)
				}
			}
			if len(childIDs) > 0 {
				if idx >= 0 && idx <= len(updated) {
					before := append([]string{}, updated[:idx]...)
					after := append([]string{}, updated[idx:]...)
					updated = append(before, append(childIDs, after...)...)
				} else {
					updated = append(updated, childIDs...)
				}
			}
			_, _ = db.DB.Collection("tree").UpdateOne(ctx,
				bson.M{"id": parentID},
				bson.M{"$set": bson.M{"childs": updated}},
			)
		}
		for _, childID := range childIDs {
			_, _ = db.DB.Collection("tree").UpdateOne(ctx,
				bson.M{"id": childID},
				bson.M{"$set": bson.M{"parent": parentID}},
			)
			_, _ = db.DB.Collection("users").UpdateOne(ctx,
				bson.M{"id": childID},
				bson.M{"$set": bson.M{"parentId": parentID}},
			)
		}
	} else {
		for _, childID := range childIDs {
			_, _ = db.DB.Collection("tree").UpdateOne(ctx,
				bson.M{"id": childID},
				bson.M{"$set": bson.M{"parent": nil}},
			)
			_, _ = db.DB.Collection("users").UpdateOne(ctx,
				bson.M{"id": childID},
				bson.M{"$set": bson.M{"parentId": nil}},
			)
		}
	}

	_, _ = db.DB.Collection("tree").UpdateOne(ctx,
		bson.M{"id": userID},
		bson.M{"$set": bson.M{"childs": []string{}}},
	)

	return nil
}
