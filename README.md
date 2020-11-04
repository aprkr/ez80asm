## EZ80 and Z80 Assembly for Visual Studio Code
The (E)Z80 Assembly extension for Visual Studio provides language support for EZ80 and Z80 Assembly, including:

### Syntax Highlighting
* Labels
* Assembler directives
* Opcodes, registers, and numbers

### Label and Macro documentation
* Add markdown documentation in comments
* Hover over a label or equate to see it's documentation
* Peek and find definitions of macros and labels
* Automatically searches all included files in the current workspace for documentation

### Global Include Directories
* Configure a global include directory in settings to automatically search for documentation
* Directory format can be parent/folder or parent\\\\folder
* Directories can be absolute or relative to the workspace
* Note that removing a directory will require VS Code to restart to reflect changes

### Possible Future Features
* Autocompletion
* Semantic highlighting, to distinguish equates and functions
* Documentation of code snippets (how many bytes, cycles etc.)

### License
This project is subject to [these terms](https://github.com/LiberalEater/ez80asm/blob/main/LICENSE.txt).

