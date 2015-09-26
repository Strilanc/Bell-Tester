Bell Tester
===========

[![Build Status](https://travis-ci.org/Strilanc/Bell-Tester.svg)](https://travis-ci.org/Strilanc/Bell-Tester)

An interactive javascript widget that allows you to try custom classical and quantum strategies for [violating bell inequalities in the CHSH game](https://en.wikipedia.org/wiki/CHSH_inequality).

# The CHSH game

- Two players, A and B, come up with a plan and are then separated
- Each player is given the result of a coin flip (c_a, c_b) (but not the other player's coin flip)
- Each player chooses a boolean value (m_a, m_b) (while still separated and knowing only one coin flip)
- The game is won iff (c_a AND c_B) == (m_a XOR m_b)

Classical strategies can't expect to win more than 75% of the time, whereas quantum strategies with pre-shared entanglement can get past 85%.

# Strategies

The widget works by taking two pieces of javascript code, one for each player, that assign a value to a variable `move` based on variables `refChoice` and `sharedMoves`.

It *should* be difficult to craft malicious javascript that wins by corrupting the game, because the move-choosing code is sandboxed into separate web workers, but feel free to surprise me.

