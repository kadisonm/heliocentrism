@AGENTS.md

Please use DRY principles.

Try to reuse code where possible.

Make new components for things that get used more than once in the code base.

Anything that replaces a generic HTML element that is not very specifically tied to one type of dataset should be created as its own component in ./src/components/common

Avoid duplicate code.

Where possible write something once that is open for extension but closed for modification.

