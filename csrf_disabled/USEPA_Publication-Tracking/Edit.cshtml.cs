using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

namespace PublicationTracking.Pages;

[ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
[IgnoreAntiforgeryToken]
public class EditModel : PageModel
{

    private readonly ILogger<IndexModel> _logger;
    private Data.PublicationContext _context;
    private Services.PublicationServices _publicationService;
    public Data.Publication Publication { get; set; }
    public List<SelectListItem> ResponsibleCodes { get; set; }
    public List<SelectListItem> AlphaDescriptors { get; set; }

    public string OriginalDocumentId { get; set; }

    public EditModel(ILogger<IndexModel> logger, Data.PublicationContext context, Services.PublicationServices publicationService)
    {
        _logger = logger;
        _context = context;
        _publicationService = publicationService;
    }

    public void OnGet(string id)
    {
        ViewData["PublicationId"] = id;
        OriginalDocumentId = id;
        Publication = _context.Publications
            .Include(p => p.AlphaDescriptor)
            .Include(p => p.ResponsibleCode)
            .Where(p => p.DocumentId == id).FirstOrDefault();
        AlphaDescriptors = _context.AlphaDescriptors.Select(a => new SelectListItem { Value = a.Code, Text = $"{a.Code} - {a.Description}" }).ToList();
        ResponsibleCodes = _context.ResponsibleCodes.Where(r => r.IsValid == true).Select(r => new SelectListItem { Value = r.Code, Text = $"{r.Code} - {r.Organization}" }).ToList();
    }

    public IActionResult OnPost()
    {
        // First, we need to get the document id, and look up the existing publication.
        var docId = Request.Form["OriginalDocumentId"].ToString();
        var pub = _context.Publications.Where(p => p.DocumentId == docId).FirstOrDefault();

        // Now, we need to update the publication with the new values.
        // did the id change?
        if (pub.DocumentId != Request.Form["Publication.DocumentId"].ToString())
        {
            // yes, so we need to update the document id, and the url.
            pub.DocumentId = Request.Form["Publication.DocumentId"].ToString();
        }

        pub.PointOfContactName = Request.Form["Publication.PointOfContactName"].ToString();
        pub.PointOfContactEmail = Request.Form["Publication.PointOfContactEmail"].ToString();
        pub.PointOfContactOrganization = Request.Form["Publication.PointOfContactOrganization"].ToString();
        pub.PointOfContactPhoneNumber = Request.Form["Publication.PointOfContactPhoneNumber"].ToString();
        pub.Title = Request.Form["Publication.Title"].ToString();
        pub.IsInternalOnly = Request.Form["Publication.IsInternalOnly"].ToString() == "true" ? true : false;
        pub.Language = (Data.Language) int.Parse(Request.Form["Publication.Language"]);
        pub.IsDigital = Request.Form["Publication.IsDigital"].ToString() == "true" ? true : false;
        pub.Url = Request.Form["Publication.Url"].ToString();
        pub.IsOriginal = Request.Form["Publication.IsOriginal"].ToString() == "true" ? true : false;
        pub.ExpectedPublicationDate = DateTime.Parse(Request.Form["Publication.ExpectedPublicationDate"].ToString());
        pub.ResponsibleCode = _context.ResponsibleCodes.Where(r => r.Code == Request.Form["Publication.ResponsibleCode"].ToString()).FirstOrDefault();
        pub.AlphaDescriptor = _context.AlphaDescriptors.Where(a => a.Code == Request.Form["Publication.AlphaDescriptor"].ToString()).FirstOrDefault();

        pub.DateLastModified = DateTime.Now;
        _context.Update(pub);
        _context.SaveChanges();

        return RedirectToPage("Index");
    }

    public IActionResult OnPostDelete(string id)  
    {  
        // First, we need to get the document id, and look up the existing publication.
        var pub = _context.Publications.Where(p => p.DocumentId == id).FirstOrDefault();

        _context.Publications.Remove(pub);
        _context.SaveChanges();

        return RedirectToPage("Index");
    }
}