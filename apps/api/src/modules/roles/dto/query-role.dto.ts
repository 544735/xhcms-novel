import { PageQueryDto } from '../../../common/dto/pagination.dto';

/** 角色列表仅需分页 + keyword（见 API_CONTRACT §9） */
export class QueryRoleDto extends PageQueryDto {}
