using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using Tresor.Api.Data;
using Tresor.Api.DTOs;
using Tresor.Api.Models;
using Tresor.Api.Services;

namespace Tresor.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly JwtService _jwt;

        public AuthController(AppDbContext db, JwtService jwt)
        {
            _db = db;
            _jwt = jwt;
        }

        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest req)
        {
            var user = await _db.Users.FirstOrDefaultAsync(x => x.Username == req.Username);
            if (user == null)
                return Unauthorized("Utilisateur introuvable ❌");

            // ✅ Vérification via BCrypt
            bool passwordValid = BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash);
            if (!passwordValid)
                return Unauthorized("Mot de passe incorrect ❌");

            // ✅ Génération du JWT
            var token = _jwt.CreateToken(user);

            return Ok(new LoginResponse
            {
                Token = token,
                Username = user.Username,
                Role = user.Role
            });
        }
    }
}
