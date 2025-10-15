using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using System.IO;
using System;
using Website.Pages;

namespace Website.Pages;

public class AccountModel2 : PageModel
{
    public ILogger<AccountModel2> _logger;

    [BindProperty]
    public string Id { get; set; } = "";
    [BindProperty]
    public string Cardnum { get; set; } = "";
    [BindProperty]
    public string Money { get; set; } = "";
    [BindProperty]
    public string Name { get; set; } = "";

    public AccountModel2(ILogger<AccountModel2> logger)
    {
        _logger = logger;
    }

    public void OnPost()
    {
        
    }

    public void OnGet()
    {
        Name=LoginModel.NAME;
        Id = AccountModel.ID;
        Cardnum = AccountModel.CARDNUM;
        Money = AccountModel.MONEY;
    }
}
