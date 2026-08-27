@AGENTS.md

Please use DRY principles.

Try to reuse code where possible.

Make new components for things that get used more than once in the code base.

Anything that replaces a generic HTML element that is not very specifically tied to one type of dataset should be created as its own component in ./src/components/common

Avoid duplicate code.

Where possible write something once that is open for extension but closed for modification.

Aim for one line comments where possible. Try to be brief and concise with comments. Avoid leaving comments longer than 4 lines.

Shorten any extremely long comments you find to match the above description.

Always use pre-existing CSS colour variables instead of creating your own colours. If you need a colour / mixes that does not exist, then ask me first. Colour mixes should derive from the base colours of the theme for consistency.

Keep src/styles/ structured to mirror src/components/ — one component's CSS per file, at the equivalent path (e.g. src/components/shared/tasks/TaskRow.tsx's styles belong in src/styles/shared/tasks/task-row.scss). When adding or editing a component's styles, split them out into their own file this way rather than appending to an existing shared/bundled file, even if that means creating a new file. Only truly global styles (resets, theme tokens, base element defaults) belong outside this per-component structure.