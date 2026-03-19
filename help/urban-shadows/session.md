# Session

At the end of each session, the MC closes the session and players answer a short
list of playbook-specific questions. Each "yes" answer earns XP.

## Player commands

```
+session                        view current session status
+session/questions              view end-of-session questions and your answers
+session/answer <#>=yes|no      answer a question by number
+session/done                   submit answers and collect XP
+session/done/force             submit now; unanswered questions count as No
```

## Flow

1. The MC runs `+session/end` to close the session and open questions.
2. Each player runs `+session/questions` to see their questions.
3. Players answer with `+session/answer 1=yes`, etc.
4. When done, run `+session/done` to collect XP.

If you miss the window, `+session/done/force` submits immediately with
unanswered questions counted as No.

## Staff

```
+session/start [<title>]        open a new session
+session/end                    end session and open questions
+session/list                   list all sessions
+session/answers [<player>]     view a player's answer history
```
