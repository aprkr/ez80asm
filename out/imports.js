const documenter = require("./symbolDocumenter")
const semantics = require("./semantics")
const diagnostics = require("./diagnostics")
const completion = require("./completion")

exports.symbolDocumenter = documenter.symbolDocumenter
exports.DocumentTable = documenter.DocumentTable
exports.semanticsProvider = semantics.semanticsProvider
exports.diagnosticProvider = diagnostics.diagnosticProvider
exports.ASMCompletionProposer = completion.ASMCompletionProposer