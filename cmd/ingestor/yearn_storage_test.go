package main

import (
	"strings"
	"testing"

	"github.com/fluidity-money/florin.so/lib/events/yearn"
	"github.com/lib/pq"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// Exercise GORM's actual model mapping without a database or network connection.
func TestYearnQueueStorageMapping(t *testing.T) {
	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN: "host=localhost user=test dbname=test sslmode=disable",
	}), &gorm.Config{DryRun: true, DisableAutomaticPing: true, SkipDefaultTransaction: true})
	require.NoError(t, err)
	for _, queue := range []pq.StringArray{{}, {"0x1111111111111111111111111111111111111111"}} {
		event := &yearn.UpdateDefaultQueue{NewDefaultQueue: queue}
		result := db.Table(event.TableName()).Omit("CreatedBy").Create(event)
		require.NoError(t, result.Error)
		require.Contains(t, result.Statement.SQL.String(), `"new_default_queue"`)
		require.False(t, strings.Contains(result.Statement.SQL.String(), `"created_by"`))
		require.Contains(t, result.Statement.Vars, queue)
	}
}
