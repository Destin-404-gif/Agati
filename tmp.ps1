
$p = "C:/xampp/htdocs/Agati/src/app/(site)/search/page.tsx"
$c = Get-Content -Raw $p
$c = $c -replace "isSearchSort\(\(sp\.sort as any\) \?\? ""relevance\) \? sp\.sort : ""relevance""", "isSearchSort((sp.sort as any) ?? ""relevance"") ? (sp.sort as any) : ""relevance"""
Set-Content -Path $p -Value $c -NoNewline
Write-Host "ok"
