module lagunalabs/matchmaking/director

go 1.17

require (
	github.com/golang/protobuf v1.5.3
	github.com/google/uuid v1.3.0
	github.com/heptiolabs/healthcheck v0.0.0-20211123025425-613501dd5deb
	github.com/kelseyhightower/envconfig v1.4.0
	google.golang.org/grpc v1.56.3
	google.golang.org/protobuf v1.33.0
	lagunalabs/matchmaking/common v0.0.0-00010101000000-000000000000
	open-match.dev/open-match v1.3.0
)

require (
	github.com/beorn7/perks v1.0.1 // indirect
	github.com/cespare/xxhash/v2 v2.2.0 // indirect
	github.com/grpc-ecosystem/grpc-gateway/v2 v2.3.0 // indirect
	github.com/matttproud/golang_protobuf_extensions v1.0.1 // indirect
	github.com/prometheus/client_golang v1.11.1 // indirect
	github.com/prometheus/client_model v0.2.0 // indirect
	github.com/prometheus/common v0.26.0 // indirect
	github.com/prometheus/procfs v0.6.0 // indirect
	golang.org/x/net v0.9.0 // indirect
	golang.org/x/sys v0.7.0 // indirect
	golang.org/x/text v0.9.0 // indirect
	google.golang.org/genproto v0.0.0-20230410155749-daa745c078e1 // indirect
	gopkg.in/DATA-DOG/go-sqlmock.v1 v1.3.0 // indirect
)

replace lagunalabs/matchmaking/common => github.com/XiaNi/matchmaking-common v0.0.0-20211116132022-5c866088088b
