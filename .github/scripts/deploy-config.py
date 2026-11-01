#!/usr/bin/env python3
"""The repository-level deploy switch, deploy_config.json at the repo root.

    deploy-config.py enabled <folder>   exit 0 if <folder> deploys, 1 if it is off
    deploy-config.py library <in> <out> copy the library page, leaving out the
                                        card of every game that is off
    deploy-config.py off                print the folders that are off, one a line

A game set to false under "games" is off. Anything else (a game not listed, a
missing or unreadable file) deploys, so a broken file can never take games
off the site by accident.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def off():
    try:
        with open(os.path.join(ROOT, 'deploy_config.json')) as f:
            games = json.load(f).get('games', {})
        return sorted(k for k, v in games.items() if v is False)
    except Exception as e:  # missing or broken: deploy everything
        print(f'deploy_config.json not read ({e}); deploying every game', file=sys.stderr)
        return []


def library(src, dst):
    html = open(src, encoding='utf-8').read()
    for game in off():
        g = re.escape(game)
        # A card is one <a class="game ..." href="<game>/"> ... </a> (cards hold no
        # other links); an entry in a list of plain links is one <li>.
        html, n = re.subn(r'\n?[ \t]*<a class="game[^"]*" href="' + g + r'/">.*?</a>[ \t]*\n?', '\n', html, flags=re.S)
        html, m = re.subn(r'\n?[ \t]*<li><a href="' + g + r'/">.*?</a></li>[ \t]*', '', html, flags=re.S)
        print(f'library: {game} is off ({n} card(s), {m} link(s) removed)')
    open(dst, 'w', encoding='utf-8').write(html)


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'enabled' and len(sys.argv) == 3:
        sys.exit(1 if sys.argv[2] in off() else 0)
    elif cmd == 'library' and len(sys.argv) == 4:
        library(sys.argv[2], sys.argv[3])
    elif cmd == 'off':
        print('\n'.join(off()))
    else:
        sys.exit(__doc__)
