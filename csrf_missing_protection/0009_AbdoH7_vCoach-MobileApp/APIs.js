import axios from 'axios'
export const LoginEndpoint = '/users/login'
export const SignupEndpoint = '/users'
export const TokenFile = 'token'
export const UserFile = 'user'
export const firstTimeFile = '/first_time'
export const DoctorPatientAssignmentsEndpoint = '/doctor_patient_assignments'
export const InvitesEndpoint = '/invites'
export const DoctorPatientAssignmentsRemoveEndpoint = '/doctor_patient_assignments/remove'
export const getExercises = '/exercises'
export const getAssignments = '/assignments'
export const showAssignment = (id) => `/assignments/${id}`
export const createAssignment = '/assignments'
export const updateAssignment = (id) => `/assignments/${id}`
export const removeAssignment = (id) => `/assignments/${id}`
export const updateUserInfo = (id) => `/users/${id}`
export const doctorUpdateAssignment = (id) => `/assignments/${id}/doctor_update`
export const Announcements = '/announcements'
export const Announcement = (id) => `/announcements/${id}`
export const Likes = '/likes'
export const Like = (id) => `/likes/${id}`
export const Comments = '/comments'
export const Comment = (id) => `/comments/${id}`


export const fetchGlobal = async (endpoint) =>{
    try{
        const response = await axios.get(endpoint)
        return {data: response.data, hasError: false}
    } catch(err){
        return {data: err, hasError: true}
    }
}

export const postGlobal = async (endpoint,data) =>{
    try{
        const response = await axios.post(endpoint,data)
        return {data: response.data, hasError: false}
    } catch(err){
        return {data: err, hasError: true}
    }
}

export const putGlobal = async (endpoint,data) =>{
    try{
        const response = await axios.put(endpoint,data)
        return {data: response.data, hasError: false}
    } catch(err){
        return {data: err, hasError: true}
    }
}

export const putGlobalFormData = async (endpoint,data) =>{
    try{
        const response = await axios.put(endpoint,data, {headers: {'Content-Type': 'multipart/form-data'}})
        return {data: response.data, hasError: false}
    } catch(err){
        return {data: err, hasError: true}
    }
}

export const deleteGlobal = async (endpoint) =>{
    try{
        const response = await axios.delete(endpoint)
        return {data: response.data, hasError: false}
    } catch(err){
        return {data: err, hasError: true}
    }
}
