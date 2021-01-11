'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const { start } = require("repl");
const commentLineRegex = /^\s*;\s*(.*)$/;
const endCommentRegex = /^[^;]+;\s*(.*)$/;
const includeLineRegex = /^\s*\#?(include)[\W]+"([^"]+)".*$/i;
const FILE_NAME = 2;
const labelDefinitionRegex = /^[\w\.]+:{0,2}/i;
// const equateRegexold = /^[\s]*[a-zA-Z_][a-zA-Z_0-9]*[\W]+(equ|set)[\W]+.*$/i;
const equateRegex = /^[\w\.]+(?=[\s\.]+equ\s+.+$)/i
const nonCommentRegex = /^([^;]+[^\,\s;])/g
const wordregex = /[\$\%]?[\w\.]+/g
const nonRegRegex = /((\$|0x)[A-Fa-f0-9]+\b)|(%[01]+\b)|(\b[01]+b\b)|(\b[0-9]+d?\b)|\b([A-Fa-f0-9]+h\b)|\b(A|B|C|D|E|F|H|L|I|R|IX|IY|IXH|IXL|IYH|IYL|AF|BC|DE|HL|PC|SP|AF'|MB)\b|\b(equ|set)\b/gi

class SymbolDescriptor {
       constructor(kind, documentation, fsPath, name) {
              this.kind = kind
              this.documentation = documentation
              this.fsPath = fsPath
              this.name = name
       }
}
class possibleRef {
       constructor(startChar, endChar, name, fsPath) {
              this.startChar = startChar
              this.endChar = endChar
              this.name = name
              this.fsPath = fsPath
       }
       get location() {
              return new vscode.Location(this.uri, this.range)
       }
       get uri() {
              return vscode.Uri.file(this.fsPath)
       }
}
class DocumentTable {
       constructor(uri) {
              this.lastModified = (fs.statSync(uri.fsPath)).mtimeMs
              this.collection = vscode.languages.createDiagnosticCollection()
              this.fsPath = uri.fsPath
              this.lineCount = 0;
              this.lines = []
              this.includes = []
              this.includeFileLines = []
       }
}
class symbolDocumenter {
       constructor() {
              this.documents = {}
              this.extensionPath = (vscode.extensions.getExtension("alex-parker.ez80-asm")).extensionPath;
              this.cacheFolder = path.join(this.extensionPath, "/caches")
       }
       /**
        * @param {vscode.TextDocument} document 
        * @param {vscode.TextDocumentChangeEvent} event
        */
       declareSymbols(document, event) {
              let table = new DocumentTable(document.uri)
              let startLine = 0
              let endLine = document.lineCount
              if (event && event.contentChanges.length > 1) {
                     if (event.contentChanges.length > 6) {
                            this.documents[document.uri.fsPath].collection.dispose()
                            this.declareSymbols(document)
                     } else {
                            for (let i = 0; i < event.contentChanges.length; i++) {
                                   const pseudoEvent = {}
                                   pseudoEvent.contentChanges = []
                                   pseudoEvent.contentChanges.push(event.contentChanges[i])
                                   this.declareSymbols(document, pseudoEvent)
                            }
                     }
                     return
              }
              if (event && event.contentChanges.length == 1) {
                     table = this.documents[document.uri.fsPath]
                     startLine = event.contentChanges[0].range.start.line
                     endLine = event.contentChanges[0].range.end.line + 1
                     const deleteEndLine = endLine
                     const diff = deleteEndLine - startLine
                     const newLinematch = event.contentChanges[0].text.match(/\n/g)
                     if (newLinematch) {
                            endLine += newLinematch.length
                     } else if (table.lines.length > document.lineCount && event.contentChanges[0].text === "") {
                            endLine = startLine + 1
                     }
                     table.lines.splice(startLine, diff)
                     let docLine = endLine
                     while (docLine < document.lineCount && commentLineRegex.exec(document.lineAt(docLine).text)) {
                            docLine++
                     }
                     if (docLine < document.lineCount && labelDefinitionRegex.exec(document.lineAt(docLine).text)) {
                            let text = document.lineAt(docLine).text.replace(/:/g, "")
                            text = (text.match(/[\.\w+]+/))[0]
                            let symbol = this.checkSymbol(text, document.uri, this.getDocSymbols(table))
                            symbol.documentation = this.getDocumentation(document, docLine, symbol.kind)
                     }
              } else if (event && event.contentChanges.length == 0) {
                     return
              } else if (!event && !this.documents[document.uri.fsPath]) {
                     this.readTableFromFile(document.uri.fsPath)
                     if (this.documents[document.uri.fsPath]) {
                            return
                     }
              }
              this.documents[document.uri.fsPath] = table
              for (let lineNumber = startLine; lineNumber < endLine; lineNumber++) {
                     const includeLineIndex = table.includeFileLines.indexOf(lineNumber)
                     if (includeLineIndex != -1) {
                            table.includeFileLines.splice(includeLineIndex, 1)
                            table.includes.splice(includeLineIndex, 1)
                     }
                     const line = {}
                     line.diagnostics = []
                     if (!event) {
                            table.lines.push(line)
                     } else {
                            table.lines.splice(lineNumber, 0, line)
                     }
                     const docLine = document.lineAt(lineNumber)
                     if (docLine.text.match(/^\s*$/)) {
                            continue
                     }
                     const commentLineMatch = commentLineRegex.exec(docLine.text);
                     if (commentLineMatch) {
                            continue;
                     }
                     const lineRefs = []
                     let firstWord = 1
                     const includeLineMatch = includeLineRegex.exec(docLine.text)
                     const labelMatch = labelDefinitionRegex.exec(docLine.text)
                     const equateMatch = equateRegex.exec(docLine.text)
                     let nonCommentMatch = docLine.text.match(nonCommentRegex)
                     nonCommentMatch = nonCommentMatch[0].replace(/(\".+\")|(\'.+\')/g, "")
                     const wordmatch = nonCommentMatch.match(wordregex);
                     if (includeLineMatch) {
                            const fileName = includeLineMatch[2]
                            const fsRelativeDir = path.dirname(document.uri.fsPath);
                            const fsPath = this._resolveFilename(fileName, fsRelativeDir); // this also documents any included files
                            if (fsPath === "") {
                                   continue
                            }
                            table.includes.push(fsPath);
                            table.includeFileLines.push(lineNumber)
                            continue
                     } else if (equateMatch) {
                            firstWord = 2
                            const kind = vscode.SymbolKind.Variable;
                            const name = equateMatch[0]
                            const documentation = this.getDocumentation(document, lineNumber, kind);
                            const symbol = new SymbolDescriptor(kind, documentation, document.uri.fsPath, name);
                            // if (this.checkSymbol(name, document.uri, table.symbolDeclarations)) {
                            //        line.symbol = symbol
                            // } else {
                            line.symbol = symbol
                            // }
                     } else if (labelMatch) {
                            firstWord = 1
                            const declaration = labelMatch[0];
                            if (declaration.match(/^\s*\.?(list|nolist|end)/)) { // these are directives, so they can't be labels
                                   continue
                            }
                            let kind = undefined;
                            if (declaration.indexOf(":") != -1) {
                                   kind = vscode.SymbolKind.Method;
                            }
                            const name = declaration.replace(/:/g, "");
                            let documentation = this.getDocumentation(document, lineNumber, kind);
                            const symbol = new SymbolDescriptor(kind == undefined ? vscode.SymbolKind.Function : kind, documentation, document.uri.fsPath, name);
                            // if (this.checkSymbol(name, document.uri, table.symbolDeclarations)) {
                            //        line.symbol = symbol
                            // } else {
                            line.symbol = symbol
                            // }
                     }
                     if (!docLine.text.match(/(^\s*\#)|(^\s*if)|(^\s*\.assume\s+adl)/i)) {
                            let char = 0
                            let startChar = 0
                            for (firstWord; firstWord < wordmatch.length; ++firstWord) {
                                   if (!wordmatch[firstWord].match(nonRegRegex)) {
                                          if (firstWord == 1 && wordmatch[firstWord].match(/\b(Z|NZ|C|NC|P|M|PO|PE)\b/i)) {
                                                 continue
                                          }
                                          startChar = nonCommentMatch.indexOf(wordmatch[firstWord], char);
                                          const endChar = startChar + wordmatch[firstWord].length
                                          const ref = new possibleRef(startChar, endChar, wordmatch[firstWord], document.uri.fsPath)
                                          lineRefs.push(ref)
                                   }
                                   char = startChar + wordmatch[firstWord].length;
                            }
                     }
                     line.refs = lineRefs
              }
       }
       /**
        * 
        * @param {vscode.TextDocument} document 
        * @param lineNumber 
        * @param kind 
        */
       getDocumentation(document, lineNumber, kind) {
              if (lineNumber == 0) {
                     return undefined
              }
              let line = document.lineAt(lineNumber);
              let documentation = undefined;
              let commentBuffer = [];
              const endCommentMatch = endCommentRegex.exec(line.text);
              if (endCommentMatch) {
                     commentBuffer.push(endCommentMatch[1]);
              }
              const trimmed = line.text.replace(/[\s]+/, " ");
              const withoutComment = trimmed.replace(/;.*$/, "");
              lineNumber--
              line = document.lineAt(lineNumber);
              let commentLineMatch = commentLineRegex.exec(line.text);
              while (commentLineMatch && commentLineMatch[1] && lineNumber >= 0) {
                     commentBuffer.unshift(commentLineMatch[1]);
                     lineNumber--
                     if (lineNumber >= 0) {
                            line = document.lineAt(lineNumber);
                            commentLineMatch = commentLineRegex.exec(line.text);
                     }
              }
              if (kind == vscode.SymbolKind.Variable) {
                     commentBuffer.unshift(withoutComment)
                     documentation = commentBuffer.join("\n")
              } else if (commentBuffer.length > 0) {
                     documentation = commentBuffer.join("\n\r");
              }
              return documentation;
       }
       _resolveFilename(filename, fsRelativeDir) {
              // Try just sticking the filename onto the directory.
              let simpleJoin = path.resolve(fsRelativeDir, filename);
              if (fs.existsSync(simpleJoin)) {
                     let includeUri = vscode.Uri.file(simpleJoin);
                     const table = this.documents[includeUri.fsPath]; // this.files is very picky
                     if (table == undefined) {
                            vscode.workspace.openTextDocument(includeUri).then((document) => {
                                   this.declareSymbols(document);
                            });
                     }
                     return simpleJoin;
              }
              // Grab the configured include paths. If it's a string, make it an array.
              var includePathConfiguration = vscode.workspace.getConfiguration().get("ez80-asm.includePath");
              if (typeof includePathConfiguration === "string") {
                     includePathConfiguration = [includePathConfiguration];
              }
              // For each configured include path
              for (var i = 0; i < includePathConfiguration.length; i++) {
                     var includePath = includePathConfiguration[i];
                     // If the path is relative, make it absolute starting from workspace root.
                     if (path.isAbsolute(includePath) == false) {
                            if (vscode.workspace.workspaceFolders) {
                                   includePath = path.resolve(vscode.workspace.workspaceFolders[0].uri.fsPath, includePath);
                            }
                     }
                     // Test for existence of the filename glued onto the include path.
                     var joined = path.resolve(includePath, filename);
                     if (fs.existsSync(joined)) {
                            let includeUri = vscode.Uri.file(joined);
                            const table = this.documents[includeUri.fsPath]; // this.files is very picky
                            if (!table) {
                                   vscode.workspace.openTextDocument(includeUri).then((document) => {
                                          this.declareSymbols(document);
                                   });
                            }
                            return includeUri.fsPath;
                     }
              }
              // Nothing found, return the empty string.
              return "";
       }
       /**
        * 
        * @param {vscode.TextDocument} document 
        */
       writeTableToFile(document) {
              const docTable = this.documents[document.uri.fsPath]
              const json = JSON.stringify(docTable)
              const base = path.basename(document.fileName)
              const cachePath = path.join(this.cacheFolder, base + ".json");
              fs.writeFile(cachePath, json, (error) => {
                     if (error) {
                            console.log(error.message)
                     }
              })
       }
       /**
        * 
        * @param {String} fsPath 
        */
       readTableFromFile(fsPath) {
              const base = path.basename(fsPath)
              const cachePath = path.join(this.cacheFolder, base + ".json");
              if (!fs.existsSync(cachePath)) {
                     return null
              }
              const fileStats = fs.statSync(fsPath)
              const table = JSON.parse(fs.readFileSync(cachePath, "utf8"));
              // for (let i = 0; i < table.possibleRefs.length; i++) {
              //        const ref = table.possibleRefs[i]
              //        table.possibleRefs[i] = new possibleRef(ref.line, ref.startChar, ref.endChar, ref.text, table.fsPath)
              // }
              if (table && table.fsPath == fsPath && table.lastModified == fileStats.mtimeMs) {
                     this.documents[fsPath] = table
                     table.collection = vscode.languages.createDiagnosticCollection();
                     for (let i = 0; i < table.includes.length; i++) {
                            this.readTableFromFile(table.includes[i])
                     }
              }
       }
       /**
        * 
        * @param {DocumentTable} table 
        * @param {{}} output 
        */
       getDocSymbols(table, output) {
              if (!output) {
                     output = {}
              }
              const lines = table.lines.filter((line, index) => {
                     line.lineNumber = index
                     return line.symbol
              })
              for (let i = 0; i < lines.length; i++) {
                     const symbol = lines[i].symbol
                     symbol.line = lines[i].lineNumber
                     output[symbol.name] = symbol
              }
              return output
       }
       getDocRefs(table, output) {
              if (!output) {
                     output = []
              }
              const lines = table.lines.filter((line, index) => {
                     line.lineNumber = index
                     return line.refs
              })
              for (let i = 0; i < lines.length; i++) {
                     for (let j = 0; j < lines[i].refs.length; j++) {
                            const ref = lines[i].refs[j]
                            ref.line = lines[i].lineNumber
                            if (!ref.range) {
                                   Object.defineProperty(ref, 'range', {
                                          get: function () { return new vscode.Range(this.line, this.startChar, this.line, this.endChar) }
                                   });
                            }
                            output.push(ref)
                     }
              }
              return output
       }
       /**
        * 
        * @param {vscode.Uri} uri 
        * @param {[]} searched 
        * @param {{}} output 
        */
       getAvailableSymbols(uri, searched, output) {
              if (!output || !searched) {
                     searched = []
                     output = {}
              }
              let table = this.documents[uri.fsPath]
              searched.push(uri.fsPath)
              this.getDocSymbols(table, output)
              for (let i = 0; i < table.includes.length; i++) { // search included files
                     if (searched.indexOf(table.includes[i]) == -1) {
                            const includeUri = vscode.Uri.file(table.includes[i])
                            this.getAvailableSymbols(includeUri, searched, output)
                     }
              }
              for (var docPath in this.documents) { // search files that include this one
                     table = this.documents[docPath]
                     for (let i = 0; i < table.includes.length; i++) {
                            if (table.includes[i] === uri.fsPath && searched.indexOf(docPath) == -1) {
                                   const docUri = vscode.Uri.file(docPath)
                                   this.getAvailableSymbols(docUri, searched, output)
                            }
                     }
              }
              return output
       }

       checkSymbol(name, uri, symbols) {
              if (!symbols) {
                     symbols = this.getAvailableSymbols(uri)
              }
              if (vscode.workspace.getConfiguration().get("ez80-asm.caseInsensitive")) {
                     const symbol = symbols[Object.keys(symbols).find(key => key.toLowerCase() === name.toLowerCase())]
                     return symbol
              } else {
                     return symbols[name]
              }
       }

}
exports.symbolDocumenter = symbolDocumenter
exports.SymbolDescriptor = SymbolDescriptor
exports.possibleRef = possibleRef
exports.DocumentTable = DocumentTable