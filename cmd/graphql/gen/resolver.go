package gen

import "database/sql"

type Resolver struct {
	FeatureFakeData bool
	DB              *sql.DB
}
