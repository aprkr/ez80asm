'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const symbolDocumenter = require("./symbolDocumenter")

class renameProvider {
       constructor(symbolDocumenter) {
              this.symbolDocumenter = symbolDocumenter
       }
       provideRenameEdits(document, position, newName, token) {
              const range = document.getWordRangeAtPosition(position, /([\w\.]+)/g);
              if (this.symbolDocumenter.checkSymbol(newName, document.uri)) {
                     vscode.window.showWarningMessage("There is already a symbol with this name")
                     return new vscode.WorkspaceEdit()
              }
              if (range) {
                     const text = document.getText(range);
                     const symbol = this.symbolDocumenter.checkSymbol(text, document.uri)
                     if (symbol) {
                            if (symbol.uri.fsPath.match(/^.+\.inc/) && symbol.uri !== document.uri) { // So you can't accidentally rename a symbol from a .inc file
                                   vscode.window.showWarningMessage("This symbol can only be changed in " + symbol.uri.fsPath)
                                   return new vscode.WorkspaceEdit()
                            }
                            const table = this.symbolDocumenter.documents[symbol.uri]
                            delete table.symbolDeclarations[text]
                            table.symbolDeclarations[newName] = new symbolDocumenter.SymbolDescriptor(symbol.line, symbol.kind, symbol.documentation, symbol.uri, newName);
                            let edits = new vscode.WorkspaceEdit()
                            edits.replace(symbol.uri, symbol.range, newName)
                            this.renameRefs(document.uri, [], edits, newName, text) // this will grab all the edits
                            return edits
                     }
              }
              vscode.window.showWarningMessage("Symbol declaration not found")
              return new vscode.WorkspaceEdit()
       }
       renameRefs(uri, searched, edits, newName, oldName) {
              let table = this.symbolDocumenter.documents[uri]
              searched.push(uri.fsPath)
              for (let i = 0; i < table.possibleRefs.length; i++) {
                     if (table.possibleRefs[i].text === oldName) {
                            const oldRef = table.possibleRefs[i]
                            table.possibleRefs.splice(i, 1)
                            i--
                            const ref = new symbolDocumenter.possibleRef(oldRef.line, oldRef.startChar, oldRef.startChar + newName.length, newName, oldRef.uri)
                            table.possibleRefs.push(ref)
                            edits.replace(oldRef.uri, oldRef.range, newName)
                     }
              }
              for (let i = 0; i < table.includes.length; i++) { // search included files
                     if (searched.indexOf(table.includes[i].fsPath) == -1) {
                            this.renameRefs(table.includes[i], searched, edits, newName, oldName)
                     }
              }
              for (var fileuri in this.symbolDocumenter.documents) { // search files that include this one
                     table = this.symbolDocumenter.documents[fileuri]
                     for (let i = 0; i < table.includes.length; i++) {
                            fileuri = vscode.Uri.parse(fileuri)
                            if (table.includes[i].fsPath === uri.fsPath && searched.indexOf(fileuri.fsPath) == -1) {
                                   this.renameRefs(fileuri, searched, edits, newName, oldName)
                            }
                     }
              }
       }
}
exports.renameProvider = renameProvider