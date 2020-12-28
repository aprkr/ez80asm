'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const commentLineRegex = /^\s*;\s*(.*)$/;
const endCommentRegex = /^[^;]+;\s*(.*)$/;
const includeLineRegex = /^\s*\#?(include)[\W]+"([^"]+)".*$/i;
const FILE_NAME = 2;
const labelDefinitionRegex = /^[\w\.]+:{0,2}((?=\s*;|\s*$)|(?=[\s\.]+equ))/i;
// const equateRegexold = /^[\s]*[a-zA-Z_][a-zA-Z_0-9]*[\W]+(equ|set)[\W]+.*$/i;
const equateRegex = /^\s*[\w\.]+\s+\.?(equ|set)\s.+/i
const nonCommentRegex = /^([^;]+[^\,\s;])/g
const wordregex = /[\$\%]?[\w\.]+/g
const nonRegRegex = /((\$|0x)[A-Fa-f0-9]+\b)|(%[01]+\b)|(\b[01]+b\b)|(\b[0-9]+d?\b)|\b([A-Fa-f0-9]+h\b)|\b(A|B|C|D|E|F|H|L|I|R|IX|IY|IXH|IXL|IYH|IYL|AF|BC|DE|HL|PC|SP|AF'|MB)\b|\b(equ|set)\b/gi

class SymbolDescriptor {
       constructor(line, kind, documentation, uri, name) {
              this.line = line
              this.kind = kind
              this.documentation = documentation
              this.uri = uri
              this.name = name
       }
       get range() {
              return new vscode.Range(this.line, 0, this.line, this.name.length)
       }
       get location() {
              return new vscode.Location(this.uri, this.range)
       }
}
class possibleRef {
       constructor(line, startChar, endChar, text) {
              this.line = line
              this.startChar = startChar
              this.endChar = endChar
              this.text = text
       }
       get range() {
              return new vscode.Range(this.line, this.startChar, this.line, this.endChar)
       }
}
class DocumentTable {
       constructor(uri) {
              this.includes = []
              this.includeFileLines = []
              this.directory = path.dirname(uri.fsPath)
              this.path = uri.fsPath
              this.symbolDeclarations = {}
              this.diagnosticCollection = vscode.languages.createDiagnosticCollection();
              this.diagnosticCollection.array = []
              this.diagnosticCollection.symarray = []
              this.lineCount = 0;
              this.possibleRefs = []
              this.refs = []
       }
       get fullArray() {
              return this.diagnosticCollection.array.concat(this.diagnosticCollection.symarray)
       }
}
class symbolDocumenter {
       constructor() {
              this.documents = {}
       }
       declareSymbols(document, event) {
              if (event && event.contentChanges.length == 0) {
                     return
              }
              let table = new DocumentTable(document.uri)
              let startLine = 0;
              let endLine = document.lineCount;
              if (event) {
                     table = this.documents[document.uri];
                     startLine = event.contentChanges[0].range.start.line
                     endLine = event.contentChanges[0].range.end.line + 1
                     let deleteEndLine = endLine
                     let newLinematch = event.contentChanges[0].text.match(/\n/g)
                     if (newLinematch) {
                            endLine += newLinematch.length
                     } else if (table.lineCount > document.lineCount && event.contentChanges[0].text === "") {
                            endLine = startLine + 1
                     }
                     while (commentLineRegex.exec(document.lineAt(endLine).text) && endLine < document.lineCount) {
                            endLine++
                     }
                     const lineDiff = table.lineCount != document.lineCount
                     for (var symName in table.symbolDeclarations) {
                            const symLine = table.symbolDeclarations[symName].line
                            if (symLine >= startLine && symLine < deleteEndLine) {
                                   delete table.symbolDeclarations[symName];
                                   continue
                            }
                            if (lineDiff && table.symbolDeclarations[symName].line >= startLine) {
                                   table.symbolDeclarations[symName].line += document.lineCount - table.lineCount
                            }            
                     }
                     for (let i = 0; i < table.possibleRefs.length; i++) {
                            if (table.possibleRefs[i].line >= startLine && table.possibleRefs[i].line < deleteEndLine) {
                                   table.possibleRefs.splice(i, 1)
                                   i--
                                   continue
                            } 
                            if (lineDiff && table.possibleRefs[i].line >= startLine) {
                                   table.possibleRefs[i].line += document.lineCount - table.lineCount
                            }
                            if (table.possibleRefs[i].line > document.lineCount - 1 || table.possibleRefs[i].line < 0) {
                                   table.possibleRefs.splice(i, 1)
                                   i--
                                   continue
                            }             
                     }
              } else {
                     table.lineCount = document.lineCount
              }
              this.documents[document.uri] = table;
              for (let lineNumber = startLine; lineNumber < endLine; lineNumber++) {
                     const line = document.lineAt(lineNumber);
                     if (line.text.match(/(^\s*$)|(^:.*)/)) {
                            continue;
                     }
                     const commentLineMatch = commentLineRegex.exec(line.text);
                     if (commentLineMatch) {
                            continue;
                     }
                     const includeLineMatch = includeLineRegex.exec(line.text);
                     const labelMatch = labelDefinitionRegex.exec(line.text);
                     let nonCommentMatch = line.text.match(nonCommentRegex)
                     nonCommentMatch = nonCommentMatch[0].replace(/(\".+\")|(\'.+\')/g, "")
                     const wordmatch = nonCommentMatch.match(wordregex);
                     if (!line.text.match(/(^section)|(^\s*\#)|(^\s*if)|(^.+macro)|(^\s*\.assume\s+adl)/i) && ((!labelMatch && !includeLineMatch) || (equateRegex.test(line.text)))) {
                            let char = 0
                            for (let index = 1; index < wordmatch.length; ++index) {
                                   if (!wordmatch[index].match(nonRegRegex)) {
                                          if (index == 1 && wordmatch[index].match(/\b(Z|NZ|C|NC|P|M|PO|PE)\b/i)) {
                                                 continue
                                          }
                                          const startChar = nonCommentMatch.indexOf(wordmatch[index], char);
                                          const endChar = startChar + wordmatch[index].length
                                          const ref = new possibleRef(lineNumber, startChar, endChar, wordmatch[index])
                                          table.possibleRefs.push(ref)
                                   }
                                   char += wordmatch[index].length;
                            }
                     }
                     if (includeLineMatch) {
                            const filename = includeLineMatch[FILE_NAME];
                            let includeLineIndex = table.includeFileLines.indexOf(lineNumber)
                            if (includeLineIndex != -1) {
                                   table.includeFileLines.splice(includeLineIndex, 1)
                                   table.includes.splice(includeLineIndex, 1)
                            }
                            const fsRelativeDir = path.dirname(document.uri.fsPath);
                            const filePath = this._resolveFilename(filename, fsRelativeDir); // this also documents any included files
                            if (filePath === "") {
                                   continue
                            }
                            const includeUri = vscode.Uri.file(filePath);
                            if (table.includes.indexOf(includeUri) == -1) {
                                   table.includes.push(includeUri);
                                   table.includeFileLines.push(lineNumber)
                            }
                     } else if (labelMatch) {
                            const declaration = labelMatch[0];
                            let kind = undefined;
                            if (declaration.indexOf(":") != -1) {
                                   kind = vscode.SymbolKind.Method;
                            } else if (equateRegex.test(line.text)) {
                                   kind = vscode.SymbolKind.Variable
                            }
                            const name = declaration.replace(/:/g, "");
                            let documentation = this.getDocumentation(document, lineNumber, kind);
                            table.symbolDeclarations[name] = new SymbolDescriptor(lineNumber, kind == undefined ? vscode.SymbolKind.Function : kind, documentation, document.uri, name);
                     }
              }
       }
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
                     const table = this.documents[includeUri]; // this.files is very picky
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
                            if (vscode.workspace.workspaceFolders !== undefined) {
                                   includePath = path.resolve(vscode.workspace.workspaceFolders[0].uri.fsPath, includePath);
                            }
                     }
                     // Test for existence of the filename glued onto the include path.
                     var joined = path.resolve(includePath, filename);
                     if (fs.existsSync(joined)) {
                            let includeUri = vscode.Uri.file(joined);
                            const table = this.documents[includeUri]; // this.files is very picky
                            if (table == undefined) {
                                   vscode.workspace.openTextDocument(includeUri).then((document) => {
                                          this.declareSymbols(document);
                                   });
                            }
                            return joined;
                     }
              }
              // Nothing found, return the empty string.
              return "";
       }
       getAvailableSymbols(uri, searched, output) {
              if (!output || !searched) {
                     searched = []
                     output = {}
              }
              let table = this.documents[uri]
              searched.push(uri.fsPath)
              for (var name in table.symbolDeclarations) { // search the current uri
                     output[name] = table.symbolDeclarations[name]
              }
              for (let i = 0; i < table.includes.length; i++) { // search included files
                     if (searched.indexOf(table.includes[i].fsPath) == -1) {
                            this.getAvailableSymbols(table.includes[i], searched, output)
                     }
              }
              for (var fileuri in this.documents) { // search files that include this one
                     table = this.documents[fileuri]
                     for (let i = 0; i < table.includes.length; i++) {
                            fileuri = vscode.Uri.parse(fileuri)
                            if (table.includes[i].fsPath === uri.fsPath && searched.indexOf(fileuri.fsPath) == -1) {
                                   this.getAvailableSymbols(fileuri, searched, output)
                            }
                     }
              }
              return output
       }
       checkSymbol(name, uri) {
              return this.getAvailableSymbols(uri)[name]
       }

}
exports.symbolDocumenter = symbolDocumenter