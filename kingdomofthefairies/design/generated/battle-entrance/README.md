# Final-battle entrance

Aurora faces the witch, who retreats to the cliff lip. The prince arrives from the left carrying Azurine, kneels to set her down, rises and steps past Aurora into the fight. Azurine remains standing behind Aurora throughout the duel and barrel scene. Both young characters use a 140-pixel painted standing height; Aurora is 200. Combat inputs stay locked during the entrance; retry checkpoints resume ready to fight.

The original and hand-tinted paired poses were generated with the built-in image tool from each edition’s existing prince/carry/Azurine references. Exact prompts and references are in generation.json. Native transparent PNGs are preserved in source/. prepare_battle_setdown.py crops alpha, fits the delivered canvas, and anchors it on Azurine’s feet without repainting. CAST and the by-eye person-height override register the paired pose using Azurine’s full standing silhouette.

Reviewed all six entrance stages in both looks in Chrome. Browser checks cover loaded artwork, equal painted heights, input lock, shelter placement, handoff to combat and retry. Unit tests cover retreat, stage timing, locked inputs, safe shelter and checkpoint state. Sprite audit run; its unrelated fluctuating bosun fit was preserved at the existing value.
