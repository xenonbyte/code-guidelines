<?php

// PHP-CS-Fixer v3 config-object form. The legacy `.php_cs` filename/return-array
// form is removed as of PHP-CS-Fixer v3; this is the current, non-deprecated shape.

$finder = PhpCsFixer\Finder::create()
    ->in(__DIR__)
    ->exclude(['vendor', 'var', 'cache', 'node_modules']);

return (new PhpCsFixer\Config())
    ->setRules([
        '@PSR12' => true,
        'array_syntax' => ['syntax' => 'short'],
        'strict_comparison' => true,
        'strict_param' => true,
        'declare_strict_types' => true,
        'no_unused_imports' => true,
        'ordered_imports' => ['sort_algorithm' => 'alpha'],
        'trailing_comma_in_multiline' => true,
        'no_empty_statement' => true,
        'single_quote' => true,
    ])
    ->setRiskyAllowed(true)
    ->setFinder($finder);
