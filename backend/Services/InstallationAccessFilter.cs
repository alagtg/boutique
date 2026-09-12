using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.Controllers;

namespace Tresor.Api.Services;

public sealed class InstallationAccessFilter(InstallationOptions installation) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var action = (ControllerActionDescriptor)context.ActionDescriptor;
        var controller = action.ControllerName;
        var user = context.HttpContext.User;
        var management = controller is "Dashboard" or "Expenses" or "StockPurchases" ||
            controller == "Loyalty" && action.ActionName is "WheelEligible" or "MonthlyGiftCandidates" or "MonthlyGiftDraw";
        if (management && !user.IsInRole("ADMIN"))
        {
            context.Result = new ForbidResult();
            return;
        }
        // Commerce retains local workflows, but central reporting and catalogue administration belong to BackOffice.
        if (installation.IsCommerce && (management ||
            controller is "Products" or "ProductVariants" && context.HttpContext.Request.Method != "GET" ||
            controller == "Settings" && context.HttpContext.Request.Method != "GET" ||
            controller == "Sales" && context.HttpContext.Request.Method == "GET"))
        {
            context.Result = new ObjectResult(new { message = "Operation disponible sur le PC BackOffice." }) { StatusCode = 403 };
            return;
        }
        await next();
    }
}
