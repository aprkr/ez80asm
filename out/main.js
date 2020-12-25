'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");

class main {
       constructor(symbolDocumenter, diagnosticProvider) {
              this.symbolDocumenter = symbolDocumenter
              this.diagnosticProvider = diagnosticProvider
              const getSymsAndDiags = async (document, event) => {
                     if (!document.fileName.match(/(ez80|z80|inc|asm)$/)) {
                            return
                     }
                     await this.symbolDocumenter.declareSymbols(document, event)
                     this.diagnosticProvider.getDiagnostics(document, event)
              }
              vscode.workspace.findFiles("**/*{Main,main}.{ez80,z80,asm}", null, 1).then((files) => {
                     files.forEach((fileURI) => {
                            vscode.workspace.openTextDocument(fileURI).then((document) => {
                                   getSymsAndDiags(document);
                            });
                     });
              });
              vscode.workspace.onDidOpenTextDocument((event) => {
                     if (!this.documents[event.document.uri]) {
                            getSymsAndDiags(event.document)
                     }
              })
              vscode.workspace.onDidChangeTextDocument((event) => {
                     getSymsAndDiags(event.document, event)

              })
              if (vscode.window.activeTextEditor && !this.symbolDocumenter.documents[vscode.window.activeTextEditor.document.uri]) {
                     getSymsAndDiags(vscode.window.activeTextEditor.document)
              }
       }

}
exports.main = main