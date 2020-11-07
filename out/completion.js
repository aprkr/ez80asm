"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const registerRegex = /\b\[?(a|f|b|c|d|e|h|l|af|bc|de|hl|hli|hld|sp|pc)\]?\b/i;
const itemSplitRegex = /,? /;
const hexRegex = /(\$[0-9a-f]+)/i;
const includeRegex = /^(?:[\w\.]+[:]{0,2})?\s*include\s+\"?/i;
const strictIncludeRegex = /^(?:[\w\.]+[:]{0,2})?\s*include\s+\"?$/i;
const firstWordRegex = /^(?:[\w\.]+[:]{0,2})?\s*\w*$/;
const sectionRegex = /^(?:[\w\.]+[:]{0,2})?\s*section\b/i;
class ASMCompletionProposer {
    constructor(symbolDocumenter) {
        this.symbolDocumenter = symbolDocumenter;
        this.instructionItems = [];
        const extension = vscode.extensions.getExtension("alex-parker.ez80-asm");
        // const instructionsJSONPath = "c:\\Users\\Alex\\Downloads\\ez80asm\\instructions.json"
        const instructionsJSONPath = path.join(extension.extensionPath, "instructions.json");
        const instructionsJSON = JSON.parse(fs.readFileSync(instructionsJSONPath, "utf8"));
        const instructions = instructionsJSON["instructions"];
        instructions.forEach((instructionJSON) => {
            const output = [instructionJSON];
            for (let index = 0; index < output.length; index++) {
                const entry = output[index]
                output.splice(index, 1);
                if (vscode.workspace.getConfiguration().get("ez80-asm.insertTab")) {
                    output.push({
                        "name": entry.name.replace(" ", "\t"),
                        "description": entry.description,
                        "cycles": entry.cycles,
                        "bytes": entry.bytes,
                        "flags": {
                            "z": entry.flags.z || "",
                            "n": entry.flags.n || "",
                            "h": entry.flags.h || "",
                            "c": entry.flags.c || ""
                        }
                    })
                } else {
                    output.push({
                        "name": entry.name,
                        "description": entry.description,
                        "cycles": entry.cycles,
                        "bytes": entry.bytes,
                        "flags": {
                            "z": entry.flags.z || "",
                            "n": entry.flags.n || "",
                            "h": entry.flags.h || "",
                            "c": entry.flags.c || ""
                        }
                    })
                }
            }
            output.forEach((element) => {
                if (vscode.workspace.getConfiguration().get("ez80-asm.caseSnippets").includes("UPPER")) {
                    element.name = element.name.toUpperCase();
                } else if (vscode.workspace.getConfiguration().get("ez80-asm.caseSnippets").includes("lower")) {
                    element.name = element.name.toLowerCase();
                }
                if (vscode.workspace.getConfiguration().get("ez80-asm.insertTabBetweenMnemonicsAndOperands")) {
                    element.name = element.name.replace(" ", "\t");
                }
                const casingUpper = vscode.workspace.getConfiguration().get("ez80-asm.alwaysUppercaseStrings");
                for (let i = 0; i < casingUpper.length; ++i) {
                    if (element.name.includes(casingUpper[i])) {
                        element.name = element.name.replace(casingUpper[i], casingUpper[i].toUpperCase());
                    }
                }
                const casingLower = vscode.workspace.getConfiguration().get("ez80-asm.alwaysLowercaseStrings");
                for (let i = 0; i < casingLower.length; ++i) {
                    if (element.name.includes(casingLower[i])) {
                        element.name = element.name.replace(casingLower[i], casingLower[i].toLowerCase());
                    }
                }

                const item = new vscode.CompletionItem(element.name, vscode.CompletionItemKind.Snippet);
                // const nameLine = `\`${element.name}\``;
                const descriptionLine = element.description;
                const cyclesLine = `**Cycles:** ${element.cycles} **Bytes:** ${element.bytes}`;
                const flagsLine = `**Flags:**`;
                const flagLines = [];
                if ((element.flags.z || "").length > 0) {
                    flagLines.push(`\\- Z: ${element.flags.z}`);
                }
                if ((element.flags.n || "").length > 0) {
                    flagLines.push(`\\- N: ${element.flags.n}`);
                }
                if ((element.flags.h || "").length > 0) {
                    flagLines.push(`\\- H: ${element.flags.h}`);
                }
                if ((element.flags.c || "").length > 0) {
                    flagLines.push(`\\- C: ${element.flags.c}`);
                }
                const lines = [descriptionLine, "", cyclesLine];
                if (flagLines.length > 0) {
                    lines.push(flagsLine);
                    flagLines.forEach((line) => {
                        lines.push(line);
                    });
                }
                item.documentation = new vscode.MarkdownString(lines.join("  \\\n"));
                let insertText = element.name;
                let tabIndex = 1;
                insertText = insertText.replace("$", "\\$");
                insertText = insertText.replace(/\b(n8|n24|r8|r24|N8|N24|R8|R24)\b/g, (substring) => {
                    return `\${${tabIndex--}:${substring}}`;
                    // return `\${0:${substring}}`;
                });
                // If there's only one completion item, set index to 0 for a better
                // experience.
                // if (tabIndex == 2) {
                //     insertText = insertText.replace("${1:", "${0:");
                // }
                if (insertText != element.name) {
                    // console.log(insertText);
                    item.insertText = new vscode.SnippetString(insertText);
                }
                this.instructionItems.push(item);
            })
        });
    }

provideCompletionItems(document, position, token, context) {
    let output = [];
    // let prefix = document.getText(new vscode.Range(position.with({ character: 0 }), position));
    // if (context.triggerCharacter == ' ') {
    //     console.log("HI")
    // }
    // let triggerWordLineRange = document.getWordRangeAtPosition(position, /.+/);
    // let triggerWordLine = document.getText(triggerWordLineRange);
    // let triggerWordRange = document.getWordRangeAtPosition(position, /[\S]+/);
    // let triggerWord = document.getText(triggerWordRange);
    // if (triggerWord.length < 2) {
    //     return output
    // }


    // const stuff = "Hello";
    // const duh = new vscode.CompletionItem(stuff, vscode.CompletionItemKind.Event);
    // const what = new vscode.SnippetString("${TM_FILENAME/(.*)/${1}/}");
    // const um = new vscode.SnippetString("adc a, ${0:n8}");
    // duh.insertText = um;
    // output.push(duh);
    if (vscode.workspace.getConfiguration().get("ez80-asm.enableSnippetSuggestions")) {
        this.instructionItems.forEach((item) => {
            output.push(item);
        })

    }
    const symbols = this.symbolDocumenter.symbols(document);
    for (const name in symbols) {
        if (symbols.hasOwnProperty(name)) {
            const symbol = symbols[name];
            let kind = vscode.CompletionItemKind.Function;
            if (symbol.kind == vscode.SymbolKind.Method) {
                kind = vscode.CompletionItemKind.Method;
            }
            if (symbol.kind == vscode.SymbolKind.Variable) {
                kind = vscode.CompletionItemKind.Variable;
            }
            const item = new vscode.CompletionItem(name, kind);
            if (symbol.documentation) {
                item.documentation = new vscode.MarkdownString(symbol.documentation);
            }
            // if (triggerWord.indexOf(".") == 0 && item.label.indexOf(".") == 0) {
            //     item.insertText = item.label.substring(1);
            // }
            //   if (symbol.isLocal && symbol.scope && symbol.scope.end) {
            //       let symbolRange = new vscode.Range(symbol.scope.start, symbol.scope.end);
            //       if (symbolRange.contains(position) == false) {
            //           continue;
            //       }
            //   }
            output.push(item);
        }
    }
    return output;
}
}
exports.ASMCompletionProposer = ASMCompletionProposer;
//# sourceMappingURL=completionProposer.js.map