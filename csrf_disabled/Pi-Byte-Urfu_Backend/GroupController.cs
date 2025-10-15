using Backend.Auth.Dto;
using Backend.Base.Dto;
using Backend.Courses.Dal.Models;
using Backend.Courses.Dto;
using Backend.Courses.Logic;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Courses.Api;


[ApiController]
[Route("api/v1/groups")]
public class GroupController
{
    private GroupService _groupService;

    public GroupController(GroupService groupService)
    {
        _groupService = groupService;
    }

    [HttpPost]
    [Route("connect")]
    public async Task<IResult> ConnectToGroup([FromHeader] UserAuthInfo authInfo, [FromBody] GroupConnectDto connectToGroupDto)
    {
        if (authInfo is null)
            throw new BadHttpRequestException(statusCode: 401, message: "Авторизуйтесь прежде, чем добавляться в группу");

        await _groupService.ConnectToGroupAsync(authInfo, connectToGroupDto);
        return Results.Ok();
    }

    [HttpGet]
    [Route("{id}")]
    public async Task<GroupGetDto> GetGroupByIdAsync([FromRoute] int id)
    {
        return await _groupService.GetGroupByIdAsync(id);
    }

    [HttpGet]
    public async Task<List<GroupGetDto>> GetAllGroups()
    {
        return await _groupService.GetAllGroupsAsync();
    }

    [HttpGet]
    [Route(template: "teachers/{userId}")]
    public async Task<List<GroupGetDto>> GetAllGroupsByTeacherUserId([FromRoute] int userId)
    {
        return await _groupService.GetAllGroupsByTeacherUserIdAsync(userId);
    }

    [HttpGet]
    [Route(template: "{groupId}/students")]
    public async Task<GroupStudentsGetAllResponseDto> GetAllStudentsByGroupId([FromRoute] int groupId)
    {
        return await _groupService.GetAllStudentsByGroupIdAsync(groupId);
    }

    [HttpGet]
    [Route(template: "{groupId}/courses")]
    public async Task<CourseGetAllDto> GetGroupCourses([FromRoute] int groupId)
    {
        return await _groupService.GetGroupCourses(groupId);
    }

    [HttpGet]
    [Route(template: "{groupId}/courses/available")]
    public async Task<CourseGetAllDto> GetAvailableGroupCourses([FromRoute] int groupId)
    {
        return await _groupService.GetAvailableGroupCourses(groupId); // just to push in master to rebuild container with CI/CD
    }

    [HttpPost]
    public async Task<BaseIdDto> CreateGroup([FromBody] GroupCreateDto createGroupDto)
    {
        var id = await _groupService.CreateGroupAsync(createGroupDto);
        return new BaseIdDto { Id = id };
    }

    [HttpPost]
    [Route(template: "{groupId}/courses/one")]
    public async Task<IResult> AddCourseToGroup([FromRoute] int groupId, [FromBody] GroupAddCourseToGroupDto groupAddCourseToGroupDto)
    {
        await _groupService.AddCourseToGroupAsync(groupId, groupAddCourseToGroupDto);
        return Results.Ok();
    }

    [HttpDelete]
    [Route(template: "{groupId}/courses/{CourseId}")]
    public async Task<IResult> DeleteCourseFromGroup([FromRoute] int groupId, [FromRoute] GroupAddCourseToGroupDto groupAddCourseToGroupDto)
    {
        await _groupService.DeleteCourseFromGroup(groupId, groupAddCourseToGroupDto);
        return Results.Ok();
    }

    [HttpPost]
    [Route(template: "{groupId}/courses/many")]
    public async Task<IResult> AddManyCoursesToGroupAsync([FromRoute] int groupId, [FromBody] GroupAddManyCoursesToGroupDto groupAddManyCoursesToGroupDto)
    {
        await _groupService.AddManyCoursesToGroupAsync(groupId, groupAddManyCoursesToGroupDto);
        return Results.Ok();
    }

    [HttpDelete]
    [Route("{id}")]
    public async Task DeleteGroupById([FromRoute] int id)
    {
        await _groupService.DeleteGroupByIdAsync(id);
    }

    [HttpPatch]
    [Route("{id}")]
    public async Task UpdateGroup([FromRoute] int id, [FromBody] GroupUpdateDto updateGroupDto)
    {
        await _groupService.UpdateGroupAsync(id, updateGroupDto);
    }
}
