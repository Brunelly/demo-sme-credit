# Review your own screenshots

Code that passes its tests can still look wrong. Before you finish a change to a screen, look at it as the users will.

## Take them

Run the pipeline's UI check yourself, once the build and tests pass (a minute or two; give it the longest timeout your
tool allows):

```bash
node /mnt/vfs/poc-verify/poc-verify.mjs ui --out /tmp/ui-review
```

Then open each `/tmp/ui-review/*.png` with your image-viewing tool (Claude Code reads image files; Codex has
`view_image`). Look at the desktop and the phone shot of every screen you changed. Read the `POC_VERIFY_RESULT` line
too: its advisories include the generic tells it found.

Outside the pipeline, start the app as the README says and screenshot it with any browser tool you have.

## Judge them

Answer each question honestly, as the user from your use-case brief, in the first five seconds:

1. What is this screen for, and who is it for? Would they know without reading a heading?
2. Is the first thing my eye lands on the thing the brief says they must see first?
3. Is the main action obvious, and is it the only loud thing?
4. Does the content look like their world (real-feeling names, formats, volumes), or like a template?
5. Is the density right for them: no wall of white space for an expert, no cramming for an occasional user?
6. Do things line up? Is there a rhythm of tight groups and clear gaps?
7. Are numbers right-aligned with units, statuses words plus tones, dates in their format?
8. Does anything on `generic-tells.md` appear?
9. On the phone shot, is the screen still usable, not just squeezed?
10. Does it look like the same app as the other screens: same tokens, same patterns, same voice?

## Act

Fix what fails, in the kit or the screen, within the story. Then take the screenshots once more and stop: one review
round is the budget, not a loop. Say in your final message what you changed after looking, in a line.
