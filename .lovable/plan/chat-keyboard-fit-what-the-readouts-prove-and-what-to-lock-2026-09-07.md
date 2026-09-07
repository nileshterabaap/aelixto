# Chat keyboard fit — what the readouts prove, and what to lock

## What the two device states show

Your screenshots contain two different states of the same phone.

**State B (correct — screenshots 3 & 4).** The web area owns the whole screen:
height 792, top inset 32, bottom inset 44 reported to the page. Keyboard opens ->
height becomes 493. Message box bottom = 493 = exactly the top of the keyboard.
Gap = 0. This is the goal.

**State A (wrong — screenshots 1, 2, 5, 6).** The web area is already trimmed
natively: height 716 (792 - 32 top - 44 bottom) and the page is told both insets
are 0. Keyboard opens -> Android subtracts the full keyboard (299) from 716 and
gives 417. But the keyboard already covers the 44 nav-bar strip that was trimmed
away, so that 44 is reserved twice. 493 - 449 = 44 -> the white band you see.

So the white gap is not a keyboard-height problem. `--kb` is already 0 and every
gap candidate reads 0 — the box is glued to the bottom of the web area; the web
area itself is 44 too short while typing.

## Values to lock

1. `--kb` stays `0` on Android. The web area already resizes; nothing may be
   subtracted from it. (Confirmed: all three gap candidates = 0.)
2. While typing (`kb-open`), the bottom safe inset must be `0` — the keyboard
   covers the nav bar, so that space must not be reserved.
3. The real insets must come from one place: ask the safe-area plugin for its
   inset values instead of trusting `env()`, because in State A `env()` lies
   (reports 0 while 44 is trimmed natively). Cache bottom inset at startup.
4. In State A only, while the keyboard is open, pull the message bar down by the
   cached bottom inset (44 here) so its bottom lands on the keyboard top. In
   State B this correction is 0, so one rule covers both.
5. Chat screen height stays `100dvh` with no keyboard math; message bar stays
   sticky at bottom 0. Keyboard-closed layout is already correct in both states
   (bottom = 717 / 792, gap 0) and must not move.

## Not touched

Safe-area architecture for status/nav bars, scoring, embeds, guarded platforms,
`Keyboard.resize`, Capacitor config, native code.

## After it lands

Rebuild the APK and check: closed = box above nav bar (unchanged), open = box
touching the keyboard, no white band. Then the debug overlay gets removed.

Probability of fixing the gap on your device: ~85%.
