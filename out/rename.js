'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const imports = require("./imports")

/**
 * Allows you to rename symbols
 */
class renameProvider {
       /**
        * @param {imports.symbolDocumenter} symbolDocumenter 
        */
       constructor(symbolDocumenter) {
              this.symbolDocumenter = symbolDocumenter
       }
       /**
        * 
        * @param {vscode.TextDocument} document 
        * @param {vscode.Position} position 
        * @param {String} newName 
        * @param {vscode.CancellationToken} token 
        */
       provideRenameEdits(document, position, newName, token) {
              if (newName.match(/;/g)) {
                     vscode.window.showWarningMessage("Invalid name")
                     return new vscode.WorkspaceEdit()
              }
              const range = document.getWordRangeAtPosition(position, /([_A-Za-z\.][\w\.]*)/g);
              const existingSymbol = this.symbolDocumenter.checkSymbol(newName, document.uri)
              if (existingSymbol) {
                     if (vscode.workspace.getConfiguration().get("ez80-asm.caseInsensitive")) {
                            if (newName.toLowerCase() === existingSymbol.name.toLowerCase()) {
                                   vscode.window.showWarningMessage("There is already a symbol with this name")
                                   return new vscode.WorkspaceEdit()
                            }
                     } else {
                            vscode.window.showWarningMessage("There is already a symbol with this name")
                            return new vscode.WorkspaceEdit()
                     }
              }
              if (range) {
                     const text = document.getText(range);
                     const symbol = this.symbolDocumenter.checkSymbol(text, document.uri)
                     if (symbol) {
                            if (symbol.fsPath.match(/^.+\.inc/) && symbol.fsPath !== document.uri.fsPath) { // So you can't accidentally rename a symbol from a .inc file
                                   vscode.window.showWarningMessage("This symbol can only be changed in " + symbol.fsPath)
                                   return new vscode.WorkspaceEdit()
                            }
                            const uri = vscode.Uri.file(symbol.fsPath)
                            let edits = new vscode.WorkspaceEdit()
                            const oldRange = new vscode.Range(symbol.line, 0, symbol.line, symbol.name.length)
                            const oldName = symbol.name
                            symbol.name = newName
                            edits.replace(uri, oldRange, newName)
                            const refs = this.symbolDocumenter.getAllof(document.uri.fsPath, "refs", [])
                            for (let i = 0; i < refs.length; i++) {
                                   let match = false
                                   if (vscode.workspace.getConfiguration().get("ez80-asm.caseInsensitive")) {
                                          match = refs[i].name.toLowerCase() === oldName.toLowerCase()
                                   } else {
                                          match = refs[i].name === oldName
                                   }
                                   if (match) {
                                          const oldRef = refs[i]
                                          const uri = vscode.Uri.file(oldRef.fsPath)
                                          edits.replace(uri, oldRef.range, newName)
                                          oldRef.endChar = oldRef.startChar + newName.length
                                          oldRef.name = newName
                                   }
                            }
                            return edits
                     }
              }
              vscode.window.showWarningMessage("Symbol declaration not found")
              return new vscode.WorkspaceEdit()
       }
}
exports.renameProvider = renameProvider