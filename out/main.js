'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");

class main {
       constructor(symbolDocumenter, diagnosticProvider) {
              this.symbolDocumenter = symbolDocumenter
              this.diagnosticProvider = diagnosticProvider
              let ms = 1000
              const scanDoc = (document, event) => {
                     if (!document.fileName.match(/(ez80|z80|inc|asm)$/i)) {
                            return
                     }
                     this.symbolDocumenter.declareSymbols(document, event)
                     setTimeout(() => { getEverythingElse(document, event) }, ms)
              }
              const getEverythingElse = (document, event) => {
                     this.diagnosticProvider.getDiagnostics(document, event)
              }
              vscode.workspace.findFiles("**/*{Main,main}.{ez80,z80,asm}", null, 1).then((files) => {
                     files.forEach((fileURI) => {
                            vscode.workspace.openTextDocument(fileURI).then((document) => {
                                   scanDoc(document);
                            });
                     });
              });
              var openTimeout = 0
              const docOpened = (document) => {
                     if (!this.symbolDocumenter.documents[document.uri] && document.fileName.match(/(ez80|z80|inc|asm)$/i)) {
                            scanDoc(document)
                     }
              }
              vscode.workspace.onDidOpenTextDocument((document) => {
                     openTimeout = setTimeout(() => { docOpened(document) }, 50) // This is to make sure declareSymbols() starts going before scanDoc   
              })
              vscode.workspace.onDidChangeTextDocument((event) => {
                     scanDoc(event.document, event)
              })
              if (vscode.window.activeTextEditor && !this.symbolDocumenter.documents[vscode.window.activeTextEditor.document.uri]) {
                     scanDoc(vscode.window.activeTextEditor.document)
              }
              ms = 100
       }
}
exports.main = main