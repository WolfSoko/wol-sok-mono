# 10. Bacteria Wars: profiles, friends, presence and matchmaking without a server

- Status: accepted
- Date: 2026-10-23
- Scope: `libs/features/lazy/bacteria-game`, `apps/bacteria-game-remote`

## Context

Online matches (ADR 0009) start from a room code passed on by hand. Players
want to find an opponent automatically, keep the people they played as
friends, see which friends are online and challenge them directly. A
player needs a face for that: a name, a picture and a motto.

The game has its own Firebase project with Firestore and anonymous (guest)
accounts that can be linked to Google (ADR 0007). It has no server code,
and new projects get Cloud Storage only on the paid plan.

## Decision

**Everyone has a profile, guests too** - `profiles/{uid}`: a name (1-24
characters), a motto (up to 80) and a picture, and whether friends may see
when the player is online. Anyone signed in reads a profile, only its owner
writes it. Linking a guest to Google keeps the uid, so the profile stays.

**A picture is one of three things**: an avatar the game draws (a bacterium
in a colour, chosen from a set), the player's Google photo (its URL), or an
image they upload. An upload is scaled down in the browser to 96 × 96 pixels
and kept in the profile document as a data URL of a few kilobytes - no
Cloud Storage, no second place to secure and clean up.

**Friendship is mutual, and each side writes only its own list** -
`players/{uid}/friends/{friendUid}`. Two ways in:

- _After an online match_, "Add as friend" puts the opponent on the
  player's own list and leaves a request in theirs
  (`players/{them}/requests/{me}`). Accepting puts the requester on the
  other list as well; declining deletes the request.
- _An invitation link_ (`#friend=<token>`) points to `invites/{token}`,
  made by the inviter. Whoever opens it and accepts writes both entries:
  the rules allow the entry on the inviter's list only with the token of an
  invitation the inviter made. Invitations expire after a week.

A player may read whether someone lists them (`players/{x}/friends/{me}`),
which is how the list tells a friend from a request still pending. Either
side can end a friendship by deleting both entries.

**Online status through the Realtime Database** - `status/{uid}` =
`online` or `playing`, written only while the player shares it, and removed
by the database itself (`onDisconnect`) when the connection drops. Firestore
has no such hook; a heartbeat there would lag by minutes and bill a write
a minute per player. The status holds no more than the state, and anyone
signed in may read it.

**Direct challenges** - a player challenges an online friend by opening a
room (ADR 0009) and leaving its code in `players/{friend}/challenges/{me}`,
allowed only when the friend lists the challenger. The friend's game shows
the challenge on any menu screen; accepting joins the room as usual.

**Matchmaking in Firestore, paired by the clients** - a player looking for
an opponent puts an entry in `queue/{uid}` and refreshes it while waiting.
Newer entries pair with older ones: the newer player opens a room and, in a
transaction, claims the oldest unclaimed entry that was seen in the last 45
seconds by writing the room code into it. The claimed player sees the code
and joins. Only the newer one claims, so two players never wait for each
other. A claimed player who never joins - a closed tab - leaves the host
waiting 20 seconds before it goes back to the queue. The host starts the
match at once on a random level that plays online.

**Opponents know each other's uid** - the first messages of a connection
carry the uid, and each side reads the other's profile from Firestore for
the name and picture in the match and on the result screen, so "Add as
friend" knows whom to ask.

**Playing with a code stays** as it was, for anyone without friends yet.

## Consequences

- The project needs a Realtime Database instance; its rules
  (`apps/bacteria-game-remote/database.rules.json`) are deployed with the
  others. Its URL goes into the web app config (`databaseURL`). Without it
  the game shows no online status and everything else works.
- Rules carry the trust that a server would: who may write which list, a
  claim written once, a challenge only between friends. Clients still
  choose what to claim; a cheating client can at worst claim the wrong
  queue entry or refuse to play.
- Queue entries, challenges and invitations expire by TTL on `expireAt`
  (`firestore.indexes.json`), and are deleted by their owner when done.
- Profiles are public to signed-in players: the name and picture are what
  others see in a match anyway. An uploaded picture is not moderated.
- Uids are not secret: every signed-in player can read the matchmaking
  queue, and every opponent learns the other's uid. So sharing the status
  does not limit it to friends - any signed-in player who knows a uid can
  read whether that player is online or playing. The game only shows it to
  friends, and turning sharing off removes it for everyone.
- A photo avatar must be a Google account photo (`lh*.googleusercontent.com`),
  so a profile cannot make other players load images from arbitrary hosts.
- Each player reads one status per friend while the friend list is open;
  big friend lists would want a server-side fan-out.
