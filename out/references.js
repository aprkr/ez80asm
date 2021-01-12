"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const imports = require("./imports")

/**
 * Provides reference locations
 */
class referenceProvider {
       /**
        * 
        * @param {imports.symbolDocumenter} symbolDocumenter 
        */
       constructor(symbolDocumenter) {
              this.symbolDocumenter = symbolDocumenter
       }
       /**
        * 
        * @param {vscode.TextDocument} document 
        * @param {vscode.Position} position 
        * @param {vscode.ReferenceContext} context 
        * @param {vscode.CancellationToken} token 
        */
       provideReferences(document, position, context, token) {
              const range = document.getWordRangeAtPosition(position, /([\w\.]+)/g);
              let output = []
              if (range) {
                     const text = document.getText(range);
                     const symbol = this.symbolDocumenter.checkSymbol(text, document.uri)
                     if (symbol) {
                            if (context.includeDeclaration) {
                                   const range = new vscode.Range(symbol.line, 0, symbol.line, symbol.name.length)
                                   const uri = vscode.Uri.file(symbol.fsPath)
                                   output.push(new vscode.Location(uri, range))
                            }
                            const refs = this.symbolDocumenter.getAllof(document.uri.fsPath, "refs", [])
                            for (let i = 0; i < refs.length; i++) {
                                   let match = false
                                   if (vscode.workspace.getConfiguration().get("ez80-asm.caseInsensitive")) {
                                          match = refs[i].name.toLowerCase() === symbol.name.toLowerCase()
                                   } else {
                                          match = refs[i].name === symbol.name
                                   }
                                   if (match) {
                                          const uri = vscode.Uri.file(refs[i].fsPath)
                                          const location = new vscode.Location(uri, refs[i].range)
                                          output.push(location)
                                   }
                            }
                            return output
                     }
              }
       }
}

exports.referenceProvider = referenceProvider