// Copyright 2026 Fluid Assets Limited BVI. All rights reserved. Use of this
// source code is governed by a BUSL license that can be found in the
// LICENSE file.

package heartbeat

import (
	"log/slog"
	"net/http"
	"os"
	"time"
)

const EnvHeartbeatUrl = "SPN_HEARTBEAT_URL"

var urls = make(chan string)

var client = &http.Client{Timeout: 10 * time.Second}

func Pulse() {
	u := <-urls
	if u == "" {
		slog.Debug("skipping request to send message to heartbeat url")
		return
	}
	slog.Debug("sending a heartbeat message")
	resp, err := client.Get(u)
	if err != nil {
		slog.Error("error reporting to heartbeat", "err", err)
		return
	}
	resp.Body.Close()
}

func init() {
	s := os.Getenv(EnvHeartbeatUrl)
	if s == "" {
		slog.Info("heartbeat imported, but empty env", "env", EnvHeartbeatUrl)
	}
	go func() {
		for {
			urls <- s
		}
	}()
}
