'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const symbolDocumenter = require("./symbolDocumenter")

/**
 * Allows you to rename symbols
 */
class renameProvider {
       constructor(symbolDocumenter) {
              this.symbolDocumenter = symbolDocumenter
       }
       provideRenameEdits(document, position, newName, token) {
              const range = document.getWordRangeAtPosition(position, /([A-Za-z\.][\w\.]*)/g);
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
                            if (symbol.uri.fsPath.match(/^.+\.inc/) && symbol.uri !== document.uri) { // So you can't accidentally rename a symbol from a .inc file
                                   vscode.window.showWarningMessage("This symbol can only be changed in " + symbol.uri.fsPath)
                                   return new vscode.WorkspaceEdit()
                            }
                            const table = this.symbolDocumenter.documents[symbol.uri]
                            delete table.symbolDeclarations[text]
                            table.symbolDeclarations[newName] = new symbolDocumenter.SymbolDescriptor(symbol.line, symbol.kind, symbol.documentation, symbol.uri, newName);
                            let edits = new vscode.WorkspaceEdit()
                            edits.replace(symbol.uri, symbol.range, newName)
                            this.addEdits(document.uri, [], edits, newName, text) // this will grab all the edits
                            return edits
                     }
              }
              vscode.window.showWarningMessage("Symbol declaration not found")
              return new vscode.WorkspaceEdit()
       }
       addEdits(uri, searched, edits, newName, oldName) {
              let table = this.symbolDocumenter.documents[uri]
              searched.push(uri.fsPath)
              let length = table.possibleRefs.length
              for (let i = 0; i < length; i++) {
                     let match = false
                     if (vscode.workspace.getConfiguration().get("ez80-asm.caseInsensitive")) {
                            match = table.possibleRefs[i].text.toLowerCase() === oldName.toLowerCase()
                     } else {
                            match = table.possibleRefs[i].text === oldName
                     }
                     if (match) {
                            const oldRef = table.possibleRefs[i]
                            table.possibleRefs.splice(i, 1)
                            length--
                            i--
                            const ref = new symbolDocumenter.possibleRef(oldRef.line, oldRef.startChar, oldRef.startChar + newName.length, newName, oldRef.uri)
                            table.possibleRefs.push(ref)
                            edits.replace(oldRef.uri, oldRef.range, newName)
                     }
              }
              for (let i = 0; i < table.includes.length; i++) { // search included files
                     if (searched.indexOf(table.includes[i].fsPath) == -1) {
                            this.addEdits(table.includes[i], searched, edits, newName, oldName)
                     }
              }
              for (var fileuri in this.symbolDocumenter.documents) { // search files that include this one
                     table = this.symbolDocumenter.documents[fileuri]
                     for (let i = 0; i < table.includes.length; i++) {
                            fileuri = vscode.Uri.parse(fileuri)
                            if (table.includes[i].fsPath === uri.fsPath && searched.indexOf(fileuri.fsPath) == -1) {
                                   this.addEdits(fileuri, searched, edits, newName, oldName)
                            }
                     }
              }
       }
}
exports.renameProvider = renameProvider