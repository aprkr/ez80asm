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
        const table = this.symbolDocumenter.documents[document.uri];
        if (!table) {
            return
        }
        const output = [];
        for (const name in table.symbolDeclarations) {
            const symbol = table.symbolDeclarations[name];
            const range = new vscode.Range(symbol.line, 0, symbol.line, symbol.name.length)
            const location = new vscode.Location(symbol.uri, range)
            output.push(new vscode.SymbolInformation(symbol.name, symbol.kind, undefined, location));     
        }
        return output;
    }
}
    exports.ASMDocumentSymbolProvider = ASMDocumentSymbolProvider;
//# sourceMappingURL=documentSymbolProvider.js.map