"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ASMDefinitionProvider {
    constructor(symbolDocumenter) {
        this.symbolDocumenter = symbolDocumenter;
    }
    provideDefinition(document, position, token) {
        const range = document.getWordRangeAtPosition(position, /(\$[0-9a-fA-F]+)|(%[0-1]+)|([0-9]+)|(\.?[A-Za-z_][A-Za-z_0-9]*(\\@|:*))/g);
        if (range) {
            const text = document.getText(range);
            const symbol = this.symbolDocumenter.symbol(text, document);
            if (symbol) {
                return symbol.location;
            }
        }
        return undefined;
    }
}
exports.ASMDefinitionProvider = ASMDefinitionProvider;
//# sourceMappingURL=definitionProvider.js.map