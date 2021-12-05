import * as classroomService from "@services/classroom.service";
import * as gradeStructureService from "@services/grade-structures.service";
import { Request, Response } from "express";
import { ClassroomModel } from "@models/classroom.model";
import { StatusCodes } from "http-status-codes";
import { INVITATION_EMAIL_ERROR, UNEXPECTED_ERROR } from "@shared/constants";
import { UserModel } from "@models/user.model";
import { stringToBoolean } from "@shared/functions";
import { mapRoleToClassrooms, Role } from "@services/role.service";
import { get } from "lodash";
import { GradeStructureModel } from "@models/grade-structure.model";
import { GradeStructureDetailModel } from "@models/grade-structure-detail.model";
import * as gradeStructureDetailService from "@services/grade-structure-detail.service";


export const getAllClassroomByUserId = async (req: Request, res: Response) => {
    const { _id } = req.user as unknown as UserModel
    const classrooms = await classroomService.getClassroomByUserId(_id)
    const result = {} as { enrolledClassrooms: any, teachingClassrooms: any }
    result.enrolledClassrooms = mapRoleToClassrooms(_id, classrooms.enrolledClassrooms)
    result.teachingClassrooms = mapRoleToClassrooms(_id, classrooms.teachingClassrooms)
    res.json(result)
}

export const createClassroom = async (req: Request, res: Response) => {
    const classroom = req.body as unknown as ClassroomModel
    const result = await classroomService.createClassroom({
        name: classroom.name,
        ownerId: classroom.ownerId,
        schoolYear: classroom.schoolYear,
        teachersId: [classroom.ownerId],
        studentsId: [],
        description: classroom.description
    } as unknown as ClassroomModel)

    res.json({ ...result, role: Role.OWNER })
}

interface InviteToClassromParams {
    isStudent: boolean,
    classId: string,
    classroomName: string,
    email: string
}

export const inviteToClassromByEmail = async (req: Request, res: Response) => {
    const payload = req.body as unknown as InviteToClassromParams
    const result = await classroomService.inviteToClassromByEmail(payload)
    res.json({ isSent: result })
}

export const getInviteLink = (req: Request, res: Response) => {
    const { classId, isStudent } = req.query as unknown as { classId: string, isStudent: string }
    const inviteLink = classroomService.createInviteLink(classId, stringToBoolean(isStudent))
    res.json(inviteLink)
}

export const joinClassByLink = async (req: Request, res: Response) => {
    const { token } = req.body as unknown as { token: string }
    const result = classroomService.verifyInviteToken(token)
    if (result) {
        const user = req.user as UserModel
        const { classId, isStudent } = result;
        const newClass = await classroomService.addNewUserToClassroom(user._id, classId, isStudent)
        if (newClass) {
            return res.json({ id: newClass._id })
        }
        return res.status(StatusCodes.BAD_REQUEST).json({ message: INVITATION_EMAIL_ERROR })
    }
    res.status(StatusCodes.BAD_REQUEST).json({ message: INVITATION_EMAIL_ERROR })
}

export const resetClassCode = async (req: Request, res: Response) => {
    const { classId } = req.body as unknown as { classId: string }
    const result = await classroomService.resetClasscode(classId)
    if (result) {
        return res.json(result)
    }
    res.status(StatusCodes.BAD_REQUEST).json({ message: UNEXPECTED_ERROR })
}

export const joinClassroomByClassCode = async (req: Request, res: Response) => {
    const { classCode } = req.body as unknown as { classCode: string }
    const user = req.user as UserModel
    const classroom = await classroomService.getClassroomByClassCode(classCode)
    if (classroom) {
        const isUserInClassrom = classroomService.isUserInClassrom(user._id, classroom)
        if (!isUserInClassrom) {
            const result = await classroomService.addNewUserToClassroom(user._id, classroom._id, true)
            return res.json({ ...result, role: Role.STUDENT })
        }
        return res.status(StatusCodes.BAD_REQUEST).json({ message: UNEXPECTED_ERROR })
    }
    res.status(StatusCodes.BAD_REQUEST).json({ message: UNEXPECTED_ERROR })
}

export const removeFromClassroom = async (req: Request, res: Response) => {
    const { classId, isStudent, userId } = req.body as unknown as { classId: string, isStudent: boolean, userId: string }
    const classroom = await classroomService.removeFromClassroom(classId, userId, isStudent)
    if (classroom) {
        return res.json({ studentsId: classroom.studentsId, teachersId: classroom.teachersId })
    }
    res.status(StatusCodes.BAD_REQUEST).json({ message: UNEXPECTED_ERROR })
}

export const getGradeStructure = async (req: Request, res: Response) => {
    const classroom = req.body.classroom
    const result = await gradeStructureService.getClassroomGradeStructure(classroom.id)
    return res.json(get(result, 'gradeStructuresDetails', []))
}

export const addGradeStructure = async (req: Request, res: Response) => {
    const gradeStructDetail = req.body as unknown as GradeStructureDetailModel
    const classId = req.body.classroom._id
    const gradeStruct = await gradeStructureService.getClassroomGradeStructure(classId)
    if (gradeStruct == null) {
        const newGradeStruct = await gradeStructureService.createGradeStructure({
            classId: classId,
            gradeStructuresDetails: []
        })
        const result = await gradeStructureDetailService.createStructureDetail({
            gradeStructureId: newGradeStruct.id,
            title: gradeStructDetail.title,
            description: gradeStructDetail.description,
            point: gradeStructDetail.point
        } as unknown as GradeStructureDetailModel)

        const updateGrade = await gradeStructureService.updateGradeStructure(classId, result._id)

        res.json({ ...result, role: Role.UPPER_ROLE })
    } else {
        const result =await gradeStructureDetailService.createStructureDetail({ 
            gradeStructureId:gradeStruct.id,
            title: gradeStructDetail.title,
            description: gradeStructDetail.description,
            point:gradeStructDetail.point
        }as unknown as GradeStructureDetailModel)

        const updateGrade = await gradeStructureService.updateGradeStructure(classId, result._id)

        res.json({ ...result, role: Role.UPPER_ROLE })
    }


}

export const removeGradeStructure=async (req:Request, res:Response)=>{
    const gradeId=req.body as unknown as GradeStructureDetailModel
    const classId = req.body.classroom._id
    const gradeStructId=gradeId.gradeStructureId
    const grade=await gradeStructureService.deleteGradeStructure(classId, gradeStructId)
    const result =await gradeStructureDetailService.deleteStructureDetail(gradeStructId)
    return res.json({ ...result, role: Role.UPPER_ROLE })
    
}

export const updateGradeStructure= async(req:Request, res:Response)=>{
    const gradeStructDetail=req.body as unknown as GradeStructureDetailModel
    const result=await gradeStructureDetailService.updateStructureDetail(gradeStructDetail.gradeStructureId,{title:gradeStructDetail.title,description:gradeStructDetail.description,point:gradeStructDetail.point})
    return res.json({ ...result})
}