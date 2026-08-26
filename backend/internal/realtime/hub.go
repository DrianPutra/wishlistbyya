package realtime

import (
	"sync"

	"github.com/gorilla/websocket"
)

type Client struct {
	Conn *websocket.Conn
	Mu   sync.Mutex
}

type Hub struct {
	mu    sync.RWMutex
	rooms map[int64]map[*Client]struct{}
}

func NewHub() *Hub {
	return &Hub{
		rooms: make(
			map[int64]map[*Client]struct{},
		),
	}
}

func (h *Hub) Register(
	folderID int64,
	conn *websocket.Conn,
) *Client {
	client := &Client{
		Conn: conn,
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	if h.rooms[folderID] == nil {
		h.rooms[folderID] =
			make(
				map[*Client]struct{},
			)
	}

	h.rooms[folderID][client] =
		struct{}{}

	return client
}

func (h *Hub) Unregister(
	folderID int64,
	client *Client,
) {
	h.mu.Lock()

	if room, exists :=
		h.rooms[folderID]; exists {

		delete(
			room,
			client,
		)

		if len(room) == 0 {
			delete(
				h.rooms,
				folderID,
			)
		}
	}

	h.mu.Unlock()

	client.Mu.Lock()
	defer client.Mu.Unlock()

	_ = client.Conn.Close()
}

func (h *Hub) Broadcast(
	folderID int64,
	message interface{},
) {
	h.mu.RLock()

	room :=
		h.rooms[folderID]

	clients :=
		make(
			[]*Client,
			0,
			len(room),
		)

	for client := range room {

		clients =
			append(
				clients,
				client,
			)
	}

	h.mu.RUnlock()

	var failed []*Client

	for _, client := range clients {

		client.Mu.Lock()

		err :=
			client.Conn.WriteJSON(
				message,
			)

		client.Mu.Unlock()

		if err != nil {
			failed =
				append(
					failed,
					client,
				)
		}
	}

	for _, client := range failed {

		h.Unregister(
			folderID,
			client,
		)
	}
}
