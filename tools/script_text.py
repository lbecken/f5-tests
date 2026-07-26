"""THE NOCTURNE TAPES — the complete spoken script.

Every line the game speaks. Keys are stable asset ids; changing the text changes
the hash and the line is re-generated, nothing else is.

Notation
--------
`[bracketed]` terms are eleven_v3 acting tags, not spoken.
Lines whose id ends in a channel suffix (`_L`, `_R`, `_C`) are mixed into one
stereo tape by assemble.py — the player must use BALANCE/FILTER to separate them.
"""

# fmt: off
LINES = {

# ═══════════════════════════════════════════════════════════════════════════
# REEL ONE — SIGN-OFF
# ═══════════════════════════════════════════════════════════════════════════

"r1_archivist_open": ("ARCHIVIST", """
[slow] There is a box on your table. I put it there.
[pause] Inside are eleven reels of quarter inch tape, and every single one of them is a
lie told by somebody who was in the room.
I can't simply tell you what happened at K B L K on the thirty first of October, nineteen
fifty seven. Not because I don't know. Because you wouldn't believe me. You'll believe the
tape. [quietly] Everyone always believes the tape.
So listen. Not to what they say — to what is underneath what they say. A microphone is an
honest thing in a room full of liars. It takes down everything: the confession and the
cough. The alibi, and the clock behind it.
They only ever counted on you hearing the words.
[deliberate] Turn the speed. Turn the balance. Take it apart.
My name doesn't matter. Call me the Archivist. Reel one is already threaded.
"""),

"r1_archivist_console": ("ARCHIVIST", """
The console in front of you came out of a restoration house in Lisbon and it does four
things. It runs the tape faster or slower — and when a tape runs slow, it runs deep, so
mind the pitch, it will tell you when you've found true speed.
It runs the tape backwards, which people forget is possible, and which some people
have relied on you forgetting.
It filters — cuts the top off the sound, or cuts the bottom out from under it.
And it takes the two sides of a stereo tape apart. That last one first, I think.
Because a broadcast tape has the programme on one side, and the room on the other.
And the room is where they tell the truth.
"""),

# ── the broadcast, LEFT channel: the programme as it went out on air ────────
"r1_bcast_L1": ("ANNOUNCER", """
[measured] K B L K, Halloway Bay. Eleven twenty on your dial.
It is nine minutes before the hour, and the Blackbird brings you — Nocturne.
[beat] Tonight: episode eighty eight. The Lady In The Wall.
Nocturne is brought to you by Halloway Savings and Loan. Your money doesn't sleep.
Neither do we.
"""),

"r1_bcast_L2": ("JULIAN", """
[low, urgent] Cora. Cora, don't go down there. The stair's rotten and there's nothing in
that cellar but nineteen years of somebody else's weather.
"""),

"r1_bcast_L3": ("VERA", """
[theatrical, controlled] Nineteen years, Inspector. And in all that time nobody has once
gone down and simply listened.
[softer] That's the whole of it, isn't it. A house doesn't hide anything. It repeats itself
until somebody bothers to hear it.
"""),

"r1_bcast_L4": ("JULIAN", """
And what does this one say?
"""),

"r1_bcast_L5": ("VERA", """
[slow, precise] It says: she never left. It says she is still in the wall on the west side
of the chimney where the plaster is warm, and it has been saying so
[a small intake of breath] every night since
the third of November, to an empty room, in a voice nobody would —
[stops]
"""),

"r1_bcast_L6": ("JULIAN", """
[a beat too long] ...Cora?
[covering, improvising] Cora — take my arm. You've gone white as the sheet.
[louder, to the room] The lady is unwell, ladies and gentlemen — no — [recovering into
character] — Cora, sit down. Sit down and let me finish it for you.
"""),

"r1_bcast_L7": ("VERA", """
[different — flatter, careful, an imitation] I'm quite all right, Inspector.
Go on. Ask me the rest of it.
"""),

# ── the broadcast, RIGHT channel: the control room talkback mic ─────────────
"r1_bcast_R1": ("EDDIE", """
[murmuring, bored] Board's hot. Levels are fine. Ride the organ down when he cues,
Marlow, she's peaking again, she always peaks on the third act —
"""),

"r1_bcast_R2": ("EDDIE", """
[muttering] Dot. Dot, gravel — now. [beat] Good.
"""),

"r1_bcast_R3": ("EDDIE", """
[sharp, low, urgent] Hey. Hey — she's not at the mic.
[louder] Marlow. Marlow, she's gone. She put the pages down and she walked. The studio
door's open, her coat's off the hook —
"""),

"r1_bcast_R4": ("KESTREL", """
[cold, absolutely level] Nobody stops.
[beat] We are on the air in four states. Nobody stops the show.
"""),

"r1_bcast_R5": ("EDDIE", """
[disbelieving] There's somebody on her mic.
"""),

"r1_bcast_R6": ("KESTREL", """
[flat] Then keep reading. Whoever that is — keep reading.
"""),

# ── the rest of reel one ───────────────────────────────────────────────────
"r1_eddie_statement": ("EDDIE", """
[tired] Statement of Edward Ferris, board engineer, K B L K. Taken the first of November,
about four in the morning, so if I'm not making sense that's why.
I had her on microphone two. I had her level in front of me the whole night — you don't
watch the talent, you watch the needle, the needle is the talent.
[beat] At forty nine minutes past ten her needle went to nothing.
And then about eleven seconds later it came back.
Now I want to be careful here because the sergeant keeps trying to help me say it.
I did not see anyone. The glass between the booth and the studio has been painted over
since the war. I heard Vera Lyle stop. I heard nobody walk in. And then I heard Vera
Lyle's lines, coming out of Vera Lyle's microphone, in a voice that was not Vera Lyle.
[pause] And the level, mister — the level never changed. Not a hair.
Whoever took over stood in exactly the spot she'd been standing in.
"""),

"r1_halligan_brief": ("HALLIGAN", """
Case four four one dash fifty seven. Lyle, Vera. Reported missing zero one November.
Subject was last observed by four witnesses in Studio A of radio station K B L K at
approximately twenty two forty nine hours. Subject did not exit by the street door —
we have the night man on that door and he's ex military and he's certain.
Subject did not exit by the alley door, which was chained from the inside and still
chained when we arrived.
Subject's coat, handbag and keys were recovered from the studio floor.
Her script was recovered from the music stand, folded to the last page she read.
[beat] I have been a policeman for nineteen years and I will tell you plainly:
a woman does not vanish out of a locked room in front of four people.
She walks out. I just can't find the door she used.
"""),

"r1_dot_index": ("DOT", """
[brisk, working, to herself] Effects index, K B L K, Vance, D. Reading for the file so
Eddie stops asking me. Here we go.
Number one — door, heavy, interior.
Number two — footsteps, gravel.
Number three — glass, breaking.
Number four — train whistle, distant.
Number five — rain on a window.
Number six — horse, walking. That's the coconuts, it's always the coconuts.
Number seven — wind, high.
Number eight — birdcage, wire.
Number nine — thunder sheet.
Number ten — water, poured.
[flatter] Eleven through sixteen, all doors. Nobody needs six doors. We have six doors.
[a pause that goes on slightly too long]
Seventeen — [hesitates] — crate. Falling. Large.
[quickly] Eighteen, hinge, rusted. Nineteen, clock, striking. Twenty, applause, small
house. That's the lot. Vance, out.
"""),

"r1_warped_vera": ("VERA", """
[low, close to the microphone, hurried] Eddie. Eddie, leave the pot open. Leave it open,
I don't care what Marlow says.
[urgent] Listen to me. If I'm not on the air by eleven, the birdcage is empty.
Tell Dot — seventeen. Tell her I said seventeen, and she'll know what to do about it.
[breath] Don't come looking for me. Look for the tape.
"""),

"r1_lock_hint": ("ARCHIVIST", """
The canister has three numbers on the dial and the man who set them was a sound man,
so he set them the way a sound man thinks.
Three effects play under that last scene. Dot numbered every effect in that building.
[quietly] Numbers, in the order you hear them. That's all a combination ever is —
a thing that happened, written down in the order it happened.
"""),

# ═══════════════════════════════════════════════════════════════════════════
# REEL TWO — THE FOLEY ROOM
# ═══════════════════════════════════════════════════════════════════════════

"r2_archivist_open": ("ARCHIVIST", """
Reel two is the Foley room. Eleven feet by nine, no window, packed to the ceiling with
junk that isn't junk.
A sheet of hanging steel is thunder. Two halves of a coconut are a horse. A tray of
gravel is a man walking to his own front door.
Dorothy Vance worked in there alone for six years making every sound that ever came out
of that station that wasn't a person talking.
[pause] Which means that if anything ever happened in that building that nobody was
supposed to hear — Dot is the only one who would recognise it.
Learn the room. Then I'll play you something from it.
"""),

"r2_dot_interview": ("DOT", """
[warm, quick, delighted to be asked] Oh, everyone asks the same thing and the answer's
always disappointing. It's never the real thing. The real thing sounds wrong.
Real rain on a real window sounds like static. You want rain, you want dried peas on a
snare drum, and you want somebody patient.
[laughs] Real fire sounds like nothing at all. Fire is cellophane. Real footsteps in a
real alley sound like a man in a room. You want a tray of gravel and a bit of shame in
your wrist.
[softer] That's the whole trick, you know. Everything in this room is a lie that tells
the truth better than the truth does.
[beat] Which is a lovely thing to say at a party. It's a horrible thing to find out is
literally correct.
"""),

"r2_dot_seventeen": ("DOT", """
[guarded] Seventeen. [beat] It's a crate. It's a big wooden crate going over.
[too fast] We used it for the warehouse episodes, we used it in the Christmas one where
the ladder goes, we used it — [stops]
[quieter] I made that effect in November of fifty five and I have never once been able to
listen to it.
Don't ask me why. Ask the tape. The tape is better at this than I am.
[whispering] Slow it down. That's all. Just slow it down and then leave me alone.
"""),

"r2_iris_audition": ("IRIS", """
[bright, professional, an audition slate] Iris Bell, for the Nocturne lead, take one,
and Mister Kestrel I promise you I can do it softer if you want it softer.
[performing] "The house is not haunted. The house is remembering, and I have simply
come at the wrong hour to overhear it."
[herself again, laughing] Was that softer? That felt softer. I'll do another.
[warm] I'd very much like this one, honestly. I've been on the wrong side of a microphone
for six years and I have got a great deal to say.
"""),

# The buried voices inside effect #17. Generated normally, then sped up 1.7x and
# mixed under the crash — the player must slow it back down to hear this.
"r2_x17_iris_1": ("IRIS", """
[frightened but steady] I've read it, Marlow. I've read all of it.
Forty one masters. My name isn't on one of them. Not one.
"""),
"r2_x17_kestrel_1": ("KESTREL", """
[very quiet] Put it down, Iris.
"""),
"r2_x17_iris_2": ("IRIS", """
[rising] I sat in that room for two years and you sold my voice like it was furniture —
Marlow, don't. Don't you dare come near that rig — [screams] no—
"""),

"r2_archivist_x17": ("ARCHIVIST", """
[very still] Now you've heard it. So have thousands of people, on ordinary evenings,
in their kitchens, under an advertisement for savings and loan.
It played as a crate for two years because a frightened woman with a grease pencil
understood one thing perfectly: the safest place to hide a sound is in a library of sounds.
[hard] That is not a crate. That is the third of November, nineteen fifty five, and it has
been on the air the entire time.
"""),

# ═══════════════════════════════════════════════════════════════════════════
# REEL THREE — PARTY LINE
# ═══════════════════════════════════════════════════════════════════════════

"r3_archivist_open": ("ARCHIVIST", """
Reel three came off the police wire recorder, and the police never listened past the
first thirty seconds because the first thirty seconds is a woman dialling a telephone.
[amused] A rotary telephone does not send a tone. It sends interruptions — it opens and
closes the line, once for a one, twice for a two, and a nought is ten.
Somebody recorded her dialling. Nobody counted.
Count. Then place the call yourself; the exchange is long dead but I have the recording
that answered.
"""),

"r3_clerk_answer": ("CLERK", """
[bored, adenoidal, reading] Halloway Bay Telephone Answering Service, good evening,
you have reached the residence of Mister and Missus Marlow Kestrel, the family is not
taking calls this evening, at the tone please leave your message and the time.
[beat, off-script] ...It's the beep. You know the beep.
"""),

"r3_vera_message": ("VERA", """
[fast, low, controlled] Ruth. Ruth, it's Vera, don't put this one in the book for him.
[breath] I know what you told me at the Christmas party and I know you'd had four and I
know you've spent two years hoping I'd forget, and I haven't, and I'm sorry.
It's seventeen, Ruth. It was in the library the whole time. Dot put it there because Dot
was frightened and Dot was right to be frightened.
[steadier] I'm going to do something on Thursday and it is going to be very loud and it is
going to look like something has happened to me.
[gently] Nothing will have happened to me. Whatever they tell you — nothing will have
happened to me. Don't cry at the thing they'll make you go to.
[beat] Ten fifty two. That's the time. You asked for the time.
"""),

# ── party line, LEFT: telephone band. Kestrel and Doyle. ───────────────────
"r3_party_L1": ("DOYLE", """
[smooth, unhurried] Marlow. Talk to me about the fourth quarter, because Meridian is not
in the business of buying a library that argues with us.
"""),
"r3_party_L2": ("KESTREL", """
Forty one masters delivered. Twelve more cut and waiting on a signature.
"""),
"r3_party_L3": ("DOYLE", """
Her signature.
"""),
"r3_party_L4": ("KESTREL", """
[dismissive] She signed in fifty four. She signed everything in fifty four. Nobody reads
a rider, Cal, that is the entire commercial value of a rider.
"""),
"r3_party_L5": ("DOYLE", """
[pleasantly] The last one read it.
[beat] I'm told that ended tidily. I'd like this one to end tidily too, and I'd like to be
told a good deal earlier.
"""),
"r3_party_L6": ("KESTREL", """
[quiet] The girl's been asking Vance about the effects library. That's all it is.
It's a filing question.
"""),
"r3_party_L7": ("DOYLE", """
[flat] Marlow. It is never a filing question.
"""),

# ── party line, RIGHT: full range. Two neighbours on the shared line. ──────
"r3_party_R1": ("RUTH", """
[hushed, gossiping] — no, on the Thursday, at the station. The actress, the one with the
voice, on the wireless.
"""),
"r3_party_R2": ("PEGGY", """
[eager] Vera Lyle! Oh, my mother is beside herself. She says a person can't simply stop
being anywhere.
"""),
"r3_party_R3": ("RUTH", """
[carefully] It's the second one, though, isn't it. That's what nobody's saying out loud.
"""),
"r3_party_R4": ("PEGGY", """
The second what?
"""),
"r3_party_R5": ("RUTH", """
[very quiet] The Bell girl. Two years back. In the little room with all the rubbish in it.
They said she pulled a rig down on herself.
[beat] Same station. Same little room. Nobody says the two things in the same sentence
and I would very much like somebody to.
"""),

# ── party line, CENTRE: muffled, through a wall. Dot and Vera. ─────────────
"r3_party_C1": ("DOT", """
[terrified whisper] I can't be the one. Vera, I can't be the one who says it out loud,
I've got a mother —
"""),
"r3_party_C2": ("VERA", """
[calm] You're not going to say it. You already said it. You said it in nineteen fifty five
with a grease pencil and you have been shouting it at that entire building every single
time somebody drops a crate.
"""),
"r3_party_C3": ("DOT", """
[breaking] It plays under the advertisements. Do you understand that? It plays under the
savings and loan.
"""),
"r3_party_C4": ("VERA", """
[steel] Good. Then everybody has already heard it, and all that's left is to make them
listen. Thursday, Dot. Leave the pot open and don't look at me.
"""),

"r3_archivist_close": ("ARCHIVIST", """
Meridian Broadcast Holdings. Forty one masters. A rider nobody reads.
[dry] They weren't buying performances. They were buying the right to be the only people
who ever owned that sound. Say a thing in the wrong year and it stops belonging to you.
[beat] Reel four is the one they'd have burned, if either of them had thought of it.
Neither of them thought of it. They were businessmen. They only ever imagined tape
going one direction.
"""),

# ═══════════════════════════════════════════════════════════════════════════
# REEL FOUR — BACKWARD
# ═══════════════════════════════════════════════════════════════════════════

# Recorded forwards, laid onto the reel backwards. The player reverses it.
"r4_vera_backward": ("VERA", """
[intimate, unhurried, absolutely calm] If you are hearing this the right way round then
you are the sort of person I was hoping for, and I am probably a very long way away,
and possibly not alive, and I'd rather you didn't spend too long on which.
[beat] My name is Vera Lyle and on Thursday I am going to disappear on purpose.
Not because I'm frightened of Marlow Kestrel. Because I'm frightened of what happens
to a story like this one when it is told quietly.
Iris Bell died in that room and it went in the paper as four lines about a faulty
counterweight. If I walk into a police station with a reel of tape I become four lines
as well. But if a woman evaporates out of a locked studio in the middle of a live
broadcast — [softly] — nobody puts that on page eleven.
[practical now] The ledger is real. It is in the safe in Marlow's office behind the
Nocturne plaque and it lists every master and every sum.
Dot left you the number. She left it the way she leaves everything. Underneath something,
on a reel that sounds like nothing at all, above where anybody thinks to listen.
[warmly] Go up. That's the only clue I'll give you. Go up.
"""),

"r4_archivist_hiss": ("ARCHIVIST", """
This reel is blank. That is the report the police wrote and that is the truthful report,
if what you mean by a reel is the part of it that people can hear.
Dot Vance recorded twenty seconds of an empty room and filed it, and the empty room has
a signal sitting on top of it, up where the tape hiss lives, where no needle jumps and
no engineer ever looks.
[a small, fond sound] She's a sound woman. She wrote it in dots.
"""),

"r4_kestrel_ledger": ("KESTREL", """
[dictating, businesslike, unbearable] Dictation, Kestrel, for the Meridian file, do not
type this one, Miss Adler, file the disc.
Item. Bell, Iris. Masters one through forty one, delivered under the fifty three rider,
consideration eleven thousand five hundred dollars, paid.
Item. Bell contract terminated third November fifty five, cause: accidental.
Note for Meridian — the termination does not affect delivery, the masters are cut and the
voice is ours in perpetuity and the estate has no standing because the estate is a mother
in Bakersfield who has never read a contract in her life.
[a pause, and something almost like feeling] Item. Lyle, Vera. Masters one through
twenty nine.
[flat again] Same rider. Same terms. Advise Meridian the second series will be complete
by the new year and I do not anticipate difficulty.
[beat] End dictation. Miss Adler, the disc goes in the safe, not the cabinet.
"""),

"r4_archivist_ledger": ("ARCHIVIST", """
Eleven thousand five hundred dollars.
[very quiet] I want you to sit with that number, because it is the only honest thing
Marlow Kestrel ever said into a microphone. Everything else that man recorded was
performance. That was accounting.
And he filed it. He filed it, because a man like that cannot bring himself to do a thing
if there isn't a record proving he did it correctly.
[beat] One reel left.
"""),

# ═══════════════════════════════════════════════════════════════════════════
# REEL FIVE — NOCTURNE
# ═══════════════════════════════════════════════════════════════════════════

"r5_archivist_open": ("ARCHIVIST", """
Eleven minutes. That's what's left.
Eleven minutes of a radio drama going out to four states, performed by a dead woman's
replacement, who was not in the building.
Everyone who has ever worked on this case has spent their time on the same question:
who came in? Which door, which shadow, which man.
[softly] Nobody ever asked the other question. Nobody asked who left.
Play the eleven minutes. Play Peggy Nash. And then use the one tool you have not needed
yet, which is the one you have had since the first reel.
"""),

# The "understudy" — generated with VERA's voice, lightly processed.
"r5_understudy_1": ("VERA", """
[flatter, plainer, an imitation of someone plainer] Go on then, Inspector. Ask me the
rest of it.
"""),
"r5_understudy_2": ("VERA", """
[same flat register] There's a seam in the plaster on the west side. You can put your
hand on it and feel the difference. It's warmer than it has any business being.
[a small intake of breath before the word] ...Every night for nineteen years.
"""),
"r5_understudy_3": ("VERA", """
[flat] No. I'm not frightened of her.
I've been frightened of everybody who said she left. That's a different thing entirely,
and it takes longer, and it is much worse.
"""),
"r5_understudy_4": ("VERA", """
[flat, then the theatricality leaking back in at the very end] Break the wall, Inspector.
Break it tonight, while somebody is still awake to hear what's behind it.
[fully Vera again, unable to help it] Because in the morning they will have plastered it
over, and called it a house, and sold it to somebody kind.
"""),

"r5_announcer_signoff": ("ANNOUNCER", """
[smooth, unbothered] You have been listening to Nocturne. Episode eighty eight —
The Lady In The Wall.
Nocturne came to you from Studio A, Halloway Bay, and was brought to you by
Halloway Savings and Loan.
[beat] The part of Cora was played by Miss Vera Lyle.
This is K B L K. Eleven twenty on your dial. Good night.
"""),

"r5_peggy": ("PEGGY", """
[indignant, nervy] I've told them four times and I'll tell you. I was in Sacramento.
I was in Sacramento at my sister's, and there are nine people at a christening who will
swear to it, and one of them is a priest, so I'd think that's rather that.
[upset] I'm the understudy. I know what everyone's saying — that I finally got my night.
[bitter laugh] I've never once gone on. Not once in two years. Miss Lyle doesn't miss.
Miss Lyle came in with a fever of a hundred and two in the March and did the whole
episode sitting on a stool.
[quieter] And I'll tell you the thing that's actually kept me up, since you're the first
one to ask me a question instead of telling me the answer.
I've listened to that recording. Everyone keeps saying it sounds like me.
[flatly] It doesn't sound like me. It sounds like somebody doing me.
"""),

"r5_halligan_close": ("HALLIGAN", """
[worn down] You want my honest opinion, off the record, and then I'd like you to leave.
Four witnesses. A chained door. A coat on the floor.
I put nineteen men on that building for six weeks. I dragged the inlet. I had a diver in
the cistern. I have a file on Marlow Kestrel four inches thick that his lawyers made into
confetti, and I have a dead actress from fifty five that the coroner called an accident
before I'd finished parking the car.
[beat] And every night for eleven years I have come back to the same stupid thing,
and I have never once put it in a report, because they'd have had my pension.
The voice on that tape is very good. It is a very good imitation of an ordinary woman.
[quietly] I have never in my life heard an ordinary woman do it that well.
"""),

"r5_kestrel_interview": ("KESTREL", """
[expansive, grieving in public] Vera Lyle was the finest instrument this station ever had
and I say instrument with the greatest possible respect.
[smooth] There is a great deal of loose talk about contracts. A contract is how a small
station in a small town keeps forty people in work. If that is unfashionable now, then I
am unfashionable, and I have been unfashionable for thirty one years, and there is a
transmitter on that hill because of it.
[a shade too fast] As for the other business — the Bell girl — that was investigated
thoroughly at the time by people who are very good at their jobs and it was an accident
in a room full of heavy equipment.
[recovering] I will not have that woman's memory used as a stick. She was a lovely girl.
I gave her her start.
[final, cold] Now. I've buried one of them and I've had the police in my building for six
weeks over the other, and I'd like you to consider what that has been like for me.
"""),

"r5_dot_final": ("DOT", """
[old, calm, forty years later] I kept the room. When they sold the building I bought the
room — the contents of it, I mean, they thought I was mad, a woman paying money for a
tray of gravel.
[beat] I couldn't leave it in there. Number seventeen. Not on a shelf where a boy with a
grease pencil might tidy it.
[very quietly] I want to say something and I want it on the tape.
I was twenty six. I heard it happen through a wall and I sat on the floor of that room
until the reel ran out, and then I did the only clever thing I have ever done in my life,
which was also the most cowardly, and I have never been able to decide which of those
two words is the true one.
[steady] I filed her. I filed a person, under C, for crate.
And every time somebody dropped a box on that station for two solid years, Iris Bell was
on the air, telling four states exactly what happened to her, and not one of us —
[stops] — not one of us was listening.
"""),

# ── the voice lineup ───────────────────────────────────────────────────────
# Four women read the identical line into the identical microphone, so the
# comparison is about the voice and nothing else. The line contains "every",
# which is where the tell lives.
"ref_line_vera": ("VERA", """
[plain, level, a studio line check] One, two. Reading for level, this is the line they
gave me. It says she never left, and every night the house repeats it to an empty room.
"""),
"ref_line_peggy": ("PEGGY", """
[plain, level, a studio line check] One, two. Reading for level, this is the line they
gave me. It says she never left, and every night the house repeats it to an empty room.
"""),
"ref_line_iris": ("IRIS", """
[plain, level, a studio line check] One, two. Reading for level, this is the line they
gave me. It says she never left, and every night the house repeats it to an empty room.
"""),
"ref_line_ruth": ("RUTH", """
[plain, level, a studio line check] One, two. Reading for level, this is the line they
gave me. It says she never left, and every night the house repeats it to an empty room.
"""),

"r5_archivist_lineup": ("ARCHIVIST", """
Four women, one line, one microphone. The police took these in the November and then
filed them, because a lineup is only any use to somebody who is prepared to believe the
answer.
[quietly] Listen to the breath. Not the voice — anybody can do a voice, I could do yours
by Thursday. Listen to where she takes her air.
A performer breathes in the same place every time she says the same word. It is the one
thing about a person that will not act.
"""),

# ── station texture ────────────────────────────────────────────────────────
"r5_station_break": ("ANNOUNCER", """
[warm, unctuous, period commercial] Friends — the nights are drawing in over Halloway Bay,
and a prudent man thinks about his family.
Halloway Savings and Loan. Three and a quarter percent, compounded quarterly, on the
corner of Ash and Bay since nineteen twenty two.
[confidential] Your money doesn't sleep. Neither do we.
[brisk] This is K B L K, eleven twenty on your dial, and it is one minute before the hour.
"""),

"r5_archivist_before_accusation": ("ARCHIVIST", """
[quiet] That's all of it. Every reel in the box.
So say it. Three things, and then we're done, and you may put the lid back on.
Who took Vera Lyle out of that studio.
What is really on effect number seventeen.
And who killed Iris Bell.
[pause] Take your time. I have taken sixty years.
"""),

# ── endings ────────────────────────────────────────────────────────────────
"r5_ending_correct": ("ARCHIVIST", """
[a long breath, and the performance drops away] Yes.
[warmer, closer to the microphone] Nobody took me. I walked out of the alley door at
seven minutes to eleven with a chain in my hand and a reel of quarter inch tape in the
lining of my coat, and I put the chain back through the hasp from the outside, which
takes eleven seconds and a great deal of practice, and I have never told a living soul
that part.
And then I stood on the corner of Ash and Bay in the rain and I listened to myself
finish the episode.
[gently] I did Peggy's voice. I'd done Peggy's voice at parties for two years and she
always laughed and told me it was cruel. It was cruel. It was also eleven minutes,
in four states, and it was the only microphone I was ever going to be given.
[steadier] They ran it on the front page for nine days. And on the sixth day a man from
the union sat down with a lawyer and a copy of the fifty three rider, and by the March
there were hearings, and by the following year that clause was unenforceable in this
state and every woman at that station owned her own voice for the first time.
Marlow Kestrel died in nineteen seventy one without ever being charged with anything at
all. That is not justice and I have never once pretended it was. But the library came
back. Forty one masters. Her name went on all of them.
[quietly] Iris Bell. Say it out loud once, would you. She was better than me.
[a pause] There's one thing left and you already know what it is.
You've had my voice in your hands for five reels.
[almost amused] Put me through the console, darling. I'm not hiding. I'm just filed.
"""),

"r5_ending_wrong": ("ARCHIVIST", """
[flat, disappointed, and something underneath it that might be relief] No.
[beat] That's the answer they printed. That's four lines on page eleven and a diver in a
cistern and a man with a four inch file that his lawyers turned into confetti.
I'm not going to tell you which part you have wrong. If I tell you, then it's my word,
and my word is worth precisely nothing — that is the entire reason this box exists.
[steadier] Go back. Not to the statements. People are the worst witnesses in the building.
Go back to the tape that isn't saying anything. The blank one. The crate. The eleven
seconds where a needle went to nothing and came back.
[softly] Everything you need has already been played to you at least twice.
"""),

"r5_ending_partial": ("ARCHIVIST", """
[carefully] Part of that is true. Not all of it, and the part you have wrong is the part
everybody has had wrong since nineteen fifty seven, so don't take it too hard.
[beat] Here is the only help I'll give you, and it isn't an answer, it's a habit.
Every single time you have found something in this box, you found it by refusing to take
a sound at the speed it was handed to you.
[quietly] There is one voice in these five reels you have never once done that to.
"""),

"r5_epilogue_unmasked": ("VERA", """
[her own voice, unprocessed, close] There she is.
[a small laugh] Sixty years, and it took you an afternoon and a speed control.
I've been talking to you in a dead woman's register this whole time because I have spent
my life learning that people will believe absolutely anything if the pitch is low enough.
[softly] Vera Lyle. Formerly of Halloway Bay. Currently, and for a very long time now,
nobody in particular — which I recommend, incidentally. It's marvellous.
[warm] Thank you for listening properly. Almost nobody does.
[beat] Put the lid back on the box. Leave it somewhere a stranger will find it.
[fading, performing one last time] This is K B L K, Halloway Bay, eleven twenty on your
dial, and that is the end of Nocturne.
[quietly] Good night.
"""),

# ═══════════════════════════════════════════════════════════════════════════
# CONSOLE / SYSTEM
# ═══════════════════════════════════════════════════════════════════════════

"sys_lock_open": ("CONSOLE", "Lock released."),
"sys_lock_fail": ("CONSOLE", "No. Try the tape again."),
"sys_reel_loaded": ("CONSOLE", "Reel threaded. Transport ready."),
"sys_card_new": ("CONSOLE", "New item logged to the evidence tray."),

# ═══════════════════════════════════════════════════════════════════════════
# HINTS — the Archivist, graded, three per reel
# ═══════════════════════════════════════════════════════════════════════════

"hint_r1_1": ("ARCHIVIST", "A broadcast tape has two sides and they are not the same recording. Take the balance all the way over. Both ways."),
"hint_r1_2": ("ARCHIVIST", "The damaged reel is not damaged. It is slow. Everything slow is deep — bring it up until she sounds like a woman instead of a foghorn."),
"hint_r1_3": ("ARCHIVIST", "Three effects under the last scene. Dot's index gives every effect a number. Three numbers, in the order you heard them. Four, nine, two."),

"hint_r2_1": ("ARCHIVIST", "Play each object, then play the scene. Your ear will do the matching if you stop trying to name things and simply compare."),
"hint_r2_2": ("ARCHIVIST", "One sound in that scene is not on any shelf in that room. It is the one that does not repeat anywhere else in the library."),
"hint_r2_3": ("ARCHIVIST", "Number seventeen. Slow it to about six tenths and take the top off it. There is a woman in there."),

"hint_r3_1": ("ARCHIVIST", "A rotary dial sends clicks, not tones. One click is a one. Ten clicks is a nought. Count the groups."),
"hint_r3_2": ("ARCHIVIST", "Three conversations on one line. Hard left is a telephone. Hard right is a kitchen. The third is behind a wall — cut the treble and it steps forward."),
"hint_r3_3": ("ARCHIVIST", "Six three nought, five two seven four. Dial it."),

"hint_r4_1": ("ARCHIVIST", "She was a radio actress. She knew a reel runs both ways and she knew which way a policeman would run it."),
"hint_r4_2": ("ARCHIVIST", "The blank reel is not blank. Cut everything below the hiss and listen up where nobody listens. Dots and dashes."),
"hint_r4_3": ("ARCHIVIST", "Eleven, nought three. The third of November. It is the only date in this entire box that matters."),

"hint_r5_1": ("ARCHIVIST", "Peggy Nash was in Sacramento and nine people and a priest will swear to it. So the question is not who came in."),
"hint_r5_2": ("ARCHIVIST", "Listen to the understudy's breath before the word 'every'. Then listen to Vera's breath before the same word in reel one."),
"hint_r5_3": ("ARCHIVIST", "She took herself. Seventeen is Iris Bell dying. Marlow Kestrel killed her. Now go and say it to my face."),
}
# fmt: on
