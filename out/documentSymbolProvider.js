"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
/**
 * Provide symbols for the go to symbol feature
 */
class ASMDocumentSymbolProvider {
    constructor(symbolDocumenter) {
        this.symbolDocumenter = symbolDocumenter;
    }
    provideDocumentSymbols(document, token) {
        const table = this.symbolDocumenter.files[document.fileName];
        if (table == null) {
            return [];
        }
        const output = [];
        for (const name in table.symbols) {
            if (table.symbols.hasOwnProperty(name)) {
                const symbol = table.symbols[name];
                let symRange = new vscode.Range(symbol.lineNumber, 0, symbol.lineNumber, name.length)
                let location = new vscode.Location(symbol.uri, symRange)
                output.push(new vscode.SymbolInformation(name, symbol.kind, undefined, location));
            }
        }
        return output;
    }
}
exports.ASMDocumentSymbolProvider = ASMDocumentSymbolProvider;
//# sourceMappingURL=documentSymbolProvider.js.map