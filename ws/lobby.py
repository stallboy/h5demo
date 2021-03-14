from websocket_server import WebsocketServer
import json


class RoomInfo:
    def __init__(self, id, sess):
        self.id = id
        self.players = [sess]
        self.moves = []

    def json(self):
        ps = []
        for p in self.players:
            ps.append(p.name)
        return {'id': self.id, 'players': ps, 'moves': self.moves}


class GameInfo:
    room_id_generator = 0

    def __init__(self, name):
        self.name = name
        self.rooms = {}  # id -> RoomInfo

    def create_room(self, sess):
        GameInfo.room_id_generator = GameInfo.room_id_generator + 1
        id = GameInfo.room_id_generator
        room = RoomInfo(id, sess)
        self.rooms[id] = room
        return room


lobby = {}  # game : GameInfo


class Session:
    def __init__(self, client, server):
        self.client = client
        self.server = server
        self.id = client['id']
        self.name = str(self.id)
        self.room_list = []

    def broadcast(self, msg_type, msg):
        self.server.send_message_to_all(json.dumps([msg_type, msg]))

    def ack(self, msg_type, msg):
        self.server.send_message(self.client, json.dumps([msg_type, msg]))

    def err(self, msg):
        self.ack("err", msg)

    def on_connect(self):
        self.broadcast('new_client', self.name)

    def on_disconnect(self):
        self.broadcast('client_left', self.name)

    def on_message(self, message):
        cmds = message.split()
        cmd = cmds[0]

        if cmd == 'list':
            self.on_list()
        elif cmd == 'name' and len(cmds) > 1:
            name = cmds[1]
            self.on_name(name)
        elif cmd == 'create' and len(cmds) > 1:
            game = cmds[1]
            self.on_create(game)
        elif cmd == 'leave' and len(cmds) > 2:
            game = cmds[1]
            room_id = int(cmd[2])
            self.on_leave(game, room_id)

    def on_list(self):
        room_list = {}
        for g, gi in lobby.items():
            room = {}
            for r, ri in gi.rooms.items():
                room[r] = ri.players[0].name
            room_list[g] = room

        self.ack('room_list', room_list)

    def on_name(self, name):
        self.name = name

    def on_create(self, game):
        if game in lobby:
            gi = lobby[game]
        else:
            gi = GameInfo(game)
            lobby[game] = gi

        room = gi.create_room(self)
        self.room_list.append(room.id)
        self.ack("room_created", room.json())

    def on_join(self, game, room_id):
        ok, gi, ri = self._check(game, room_id)
        if not ok:
            return

        if self not in ri.players:
            ri.players.append(self)
            self.room_list.append(room_id)

        self.ack('room_joined_in', ri.json())

    # 用户可以同时在多个房间中
    def on_leave(self, game, room_id):
        ok, gi, ri = self._check(game, room_id)
        if not ok:
            return

        if self in ri.players:
            ri.players.remove(self)
            self.room_list.remove(room_id)
            if len(ri.players) == 0:
                del gi.rooms[room_id]

        self.ack('room_left', [game, room_id])

    def on_move(self, game, room_id, move):
        pass

    def _check(self, game, room_id):
        if game not in lobby:
            self.err("%s[%d] 不存在" % (game, room_id))
            return False, None, None

        gi = lobby[game]
        if room_id not in gi.rooms:
            self.err("%s[%d] 不存在" % (game, room_id))
            return False, gi, None

        ri = gi.rooms[room_id]
        return True, gi, ri


def new_client(client, server):
    print("New client connected and was given id %d" % client['id'])
    sess = Session(client, server)
    client['session'] = sess
    sess.on_connect()


def client_left(client, server):
    print("Client(%d) disconnected" % client['id'])
    client['session'].on_disconnect()


def message_received(client, server, message):
    print("Client(%d) said: %s" % (client['id'], message))
    client['session'].on_message(message)


PORT = 9001
ws = WebsocketServer(PORT)
ws.set_fn_new_client(new_client)
ws.set_fn_client_left(client_left)
ws.set_fn_message_received(message_received)
ws.run_forever()
