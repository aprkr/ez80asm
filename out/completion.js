"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
/**
 * Provides the completions items for Intellisense,
 * uses instruction.json to create snippets and the 
 * error watcher uses the snippets as well
 */
class ASMCompletionProposer {
    constructor(symbolDocumenter) {
        this.symbolDocumenter = symbolDocumenter;
        this.instructionItems = [];
        this.instructionItemsNonForm = [];
        const extension = vscode.extensions.getExtension("alex-parker.ez80-asm");
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
                            "c": entry.flags.c || "",
                            "pv": entry.flags.pv || ""
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
                            "c": entry.flags.c || "",
                            "pv": entry.flags.pv || ""
                        }
                    })
                }
            }
            output.forEach((element) => {
                let someList = [];
                someList = replaceStuff(element.name);
                for (let i = 0; i < someList.length; ++i) {
                    this.instructionItemsNonForm = this.instructionItemsNonForm.concat(replaceStuff(someList[i]))
                }
                function replaceStuff(name) {
                    let runningList = [];
                    if (name.includes("a,") && !name.includes("ld a")) {
                        runningList.push(name.replace("a, ", ""));
                    }
                    if (name.includes("r8")) {
                        runningList.push(name.replace("r8", "a"));
                        runningList.push(name.replace("r8", "b"));
                        runningList.push(name.replace("r8", "c"));
                        runningList.push(name.replace("r8", "d"));
                        runningList.push(name.replace("r8", "e"));
                        runningList.push(name.replace("r8", "h"));
                        runningList.push(name.replace("r8", "l"));
                    } else if (name.includes("r24")) {
                        runningList.push(name.replace("r24", "bc"));
                        runningList.push(name.replace("r24", "de"));
                        runningList.push(name.replace("r24", "hl"));
                    } else if (name.includes(" ir")) {
                        runningList.push(name.replace("ir", "ixh"));
                        runningList.push(name.replace("ir", "ixl"));
                        runningList.push(name.replace("ir", "iyh"));
                        runningList.push(name.replace("ir", "iyl"));
                    } else if (name.includes("ix/y")) {
                        if (name.includes("ix/y+d")) {
                            runningList.push(name.replace("ix/y+d", "ix"))
                            runningList.push(name.replace("ix/y+d", "iy"))
                        }
                        runningList.push(name.replace("ix/y", "ix"));
                        runningList.push(name.replace("ix/y", "iy"));
                    } else if (name.includes("rxy")) {
                        runningList.push(name.replace("rxy", "bc"));
                        runningList.push(name.replace("rxy", "de"));
                        runningList.push(name.replace("rxy", "ix"));
                        runningList.push(name.replace("rxy", "iy"));
                    } else if (name.includes("jr cc")) {
                        runningList.push(name.replace("cc", "c"));
                        runningList.push(name.replace("cc", "nc"));
                        runningList.push(name.replace("cc", "z"));
                        runningList.push(name.replace("cc", "nz"));
                    } else if (name.includes("cc")) {
                        runningList.push(name.replace("cc", "c"));
                        runningList.push(name.replace("cc", "nc"));
                        runningList.push(name.replace("cc", "z"));
                        runningList.push(name.replace("cc", "nz"));
                        runningList.push(name.replace("cc", "p"));
                        runningList.push(name.replace("cc", "m"));
                        runningList.push(name.replace("cc", "po"));
                        runningList.push(name.replace("cc", "pe"));
                    } else {
                        runningList.push(name)
                    }
                    return runningList;
                }
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
                if ((element.flags.pv || "").length > 0) {
                    flagLines.push(`\\- P/V: ${element.flags.pv}`);
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
                insertText = insertText.replace(/\b(r8|R8|r24|R24|n|N|mmn|MMN|ir|IR|ix\/y|IX\/Y|d|D|rxy|RXY|bit|BIT|cc|CC)\b/g, (substring) => {
                    return `\${${tabIndex++}:${substring}}`;
                });
                // If there's only one completion item, set index to 0 for a better
                // experience.
                if (tabIndex == 2) {
                    insertText = insertText.replace("${1:", "${0:");
                }
                if (insertText != element.name) {
                    item.insertText = new vscode.SnippetString(insertText);
                }
                this.instructionItems.push(item);
            })
            this.instructionItemsNonForm = [...new Set(this.instructionItemsNonForm)]
        });
    }
    /**
     * 
     * @param {vscode.TextDocument} document 
     * @param {vscode.Position} position 
     * @param {vscode.CancellationToken} token 
     * @param {vscode.CompletionContext} context 
     */
    provideCompletionItems(document, position, token, context) {
        let output = [];
        if (vscode.workspace.getConfiguration().get("ez80-asm.enableSnippetSuggestions")) {
            this.instructionItems.forEach((item) => {
                output.push(item);
            })
        }
        const symbols = this.symbolDocumenter.getAvailableSymbols(document.uri);
        const line = document.lineAt(position.line)
        if (!line.text.match(/^\s*\w+\s*$/)) {
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
                    output.push(item);
                }
            }
        }
        return output;
    }
}
exports.ASMCompletionProposer = ASMCompletionProposer;
//# sourceMappingURL=completionProposer.js.map