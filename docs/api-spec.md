# API Specification

**API version:** v1  
**Base URL:** `/api/v1`

## 1. Quy ước chung

| Hạng mục | Quy ước |
|---|---|
| Base URL | `/api/v1` (riêng `/health` nằm ở gốc) |
| Định dạng | Request và response đều sử dụng JSON |
| Content-Type | `application/json; charset=utf-8` |
| Tên trường | `snake_case`, thống nhất với tên cột database |
| `id` | Số nguyên dương, tương ứng kiểu `BIGINT` trong MySQL |
| `due_date` | Chuỗi `YYYY-MM-DD`, không bao gồm giờ, tương ứng kiểu `DATE` |
| `created_at`, `updated_at` | Thời điểm UTC, trả về theo ISO 8601, ví dụ `2026-10-31T08:00:00Z` |
| `status` | `pending` hoặc `completed` (chữ thường, đúng chính tả) |
| Xác thực | Header `Authorization: Bearer <token>` |

## 2. Danh sách endpoint

| # | Phương thức | Đường dẫn | Mô tả | Xác thực | Thành công |
|---|---|---|---|---|---|
| 1 | POST | `/api/v1/auth/register` | Đăng ký tài khoản | Không | 201 |
| 2 | POST | `/api/v1/auth/login` | Đăng nhập, nhận token | Không | 200 |
| 3 | POST | `/api/v1/tasks` | Tạo công việc | Có | 201 |
| 4 | GET | `/api/v1/tasks` | Lấy danh sách công việc, lọc theo trạng thái | Có | 200 |
| 5 | GET | `/api/v1/tasks/{id}` | Xem chi tiết một công việc | Có | 200 |
| 6 | PATCH | `/api/v1/tasks/{id}` | Cập nhật công việc | Có | 200 |
| 7 | DELETE | `/api/v1/tasks/{id}` | Xóa công việc | Có | 204 |
| 8 | GET | `/health` | Kiểm tra trạng thái ứng dụng và database | Không | 200 / 503 |

Cập nhật sử dụng **PATCH**: client chỉ gửi những trường cần thay đổi. Không triển khai PUT để tránh có hai cơ chế cập nhật cùng một tài nguyên.

## 3. Chi tiết từng endpoint

### 3.1. Đăng ký tài khoản

**Endpoint:** `POST /api/v1/auth/register`

**Request body:**

| Trường | Kiểu | Bắt buộc | Quy tắc |
|---|---|---|---|
| `email` | string | Có | Email hợp lệ, tối đa 255 ký tự; trim và chuyển thành chữ thường |
| `password` | string | Có | Từ 8 đến 72 byte UTF-8 |
| `display_name` | string hoặc null | Không | Từ 1 đến 100 ký tự sau khi trim, hoặc `null` |

Ví dụ:

```json
{
  "email": "An@Example.com",
  "password": "matkhau123",
  "display_name": "An"
}
```

**Response: `201 Created`**

```json
{
  "id": 1,
  "email": "an@example.com",
  "display_name": "An",
  "created_at": "2026-10-31T08:00:00Z"
}
```

- Không trả về trường `password` chứa mật khẩu đã hash.
- Đăng ký thành công không tự động đăng nhập.
- Email được chuẩn hóa (trim, chữ thường) trước khi lưu vào MySQL.
- Nếu email đã tồn tại, trả về `409 Conflict` với mã lỗi `EMAIL_ALREADY_EXISTS`.

### 3.2. Đăng nhập

**Endpoint:** `POST /api/v1/auth/login`

**Request body:**

| Trường | Kiểu | Bắt buộc | Quy tắc |
|---|---|---|---|
| `email` | string | Có | Trim và chuyển chữ thường trước khi tra cứu, giống bước chuẩn hóa khi đăng ký |
| `password` | string | Có | Không trim; xác minh với hash trong cột `password` |

Ví dụ:

```json
{
  "email": "an@example.com",
  "password": "matkhau123"
}
```

**Response: `200 OK`**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": {
    "id": 1,
    "email": "an@example.com",
    "display_name": "An"
  }
}
```

Lỗi:

- `400`: Thiếu trường hoặc dữ liệu không hợp lệ.
- `401 INVALID_CREDENTIALS`: Email hoặc mật khẩu không chính xác.

Sai email và sai mật khẩu phải trả về cùng một thông báo để tránh tiết lộ email nào đã đăng ký.

### 3.3. Tạo công việc

**Endpoint:** `POST /api/v1/tasks`

**Request body:**

| Trường | Kiểu | Bắt buộc | Quy tắc |
|---|---|---|---|
| `title` | string | Có | Từ 1 đến 255 ký tự sau khi trim |
| `description` | string hoặc null | Không | Tối đa 10.000 ký tự, mặc định `null` |
| `due_date` | string hoặc null | Không | Định dạng `YYYY-MM-DD`, phải là ngày hợp lệ; mặc định `null` |
| `status` | string | Không | `pending` hoặc `completed`, mặc định `pending` |

Ví dụ:

```json
{
  "title": "Nộp báo cáo Cloud",
  "description": "Bản PDF 10-20 trang",
  "due_date": "2026-11-15"
}
```

**Response: `201 Created`**

Header:

```http
Location: /api/v1/tasks/12
```

Response body:

```json
{
  "id": 12,
  "title": "Nộp báo cáo Cloud",
  "description": "Bản PDF 10-20 trang",
  "due_date": "2026-11-15",
  "status": "pending",
  "created_at": "2026-10-31T08:05:00Z",
  "updated_at": "2026-10-31T08:05:00Z"
}
```

**Quy tắc:**

- `user_id` được lấy từ JWT của người dùng đang đăng nhập.
- Không nhận `user_id` từ request body.
- Không trả `user_id` trong response.
- Backend tự tạo `id` bằng cơ chế `AUTO_INCREMENT` của MySQL.

### 3.4. Lấy danh sách công việc

**Endpoint:** `GET /api/v1/tasks`

**Query parameters:**

| Tham số | Bắt buộc | Giá trị | Ghi chú |
|---|---|---|---|
| `status` | Không | `pending` hoặc `completed` | Bỏ trống để lấy tất cả công việc |

Ví dụ:

```http
GET /api/v1/tasks?status=pending
```

Nếu `status` không thuộc hai giá trị được hỗ trợ, API trả về `400 VALIDATION_ERROR`.

**Quy tắc truy vấn:**

- Chỉ trả về công việc thuộc người dùng đang đăng nhập.
- Nếu có `status`, chỉ lấy các công việc có trạng thái tương ứng.
- Sắp xếp theo `due_date` tăng dần.
- Công việc không có hạn (`due_date IS NULL`) nằm cuối danh sách.
- Nếu cùng hạn, sắp xếp theo `id` tăng dần.

Để thực hiện thứ tự trên trong MySQL, sử dụng:

```sql
ORDER BY
    due_date IS NULL ASC,
    due_date ASC,
    id ASC;
```

Ví dụ response:

```json
{
  "items": [
    {
      "id": 12,
      "title": "Nộp báo cáo Cloud",
      "description": "Bản PDF 10-20 trang",
      "due_date": "2026-11-15",
      "status": "pending",
      "created_at": "2026-10-31T08:05:00Z",
      "updated_at": "2026-10-31T08:05:00Z"
    }
  ],
  "count": 1
}
```

Nếu không có công việc, API trả về `200 OK`:

```json
{
  "items": [],
  "count": 0
}
```

API sử dụng object chứa `items` và `count` thay vì trả về mảng trực tiếp để có thể bổ sung phân trang trong tương lai mà không cần thay đổi cấu trúc response.

**Lưu ý về hiệu năng MySQL:** Việc sắp xếp `NULL` xuống cuối bằng biểu thức `due_date IS NULL` có thể khiến MySQL sử dụng `filesort` thay vì tận dụng hoàn toàn thứ tự của index. Với quy mô dữ liệu của project, nhóm chấp nhận lựa chọn này để ưu tiên trải nghiệm hiển thị.

### 3.5. Xem chi tiết một công việc

**Endpoint:** `GET /api/v1/tasks/{id}`

Ví dụ:

```http
GET /api/v1/tasks/12
```

Quy tắc:

- `{id}` phải là số nguyên dương.
- Chỉ trả về công việc thuộc người dùng đang đăng nhập.
- Response có cấu trúc giống response của endpoint tạo công việc.
- Nếu công việc không tồn tại hoặc không thuộc người dùng hiện tại, trả về `404 TASK_NOT_FOUND`.

Lỗi:

- `400`: ID không hợp lệ.
- `401`: Token không hợp lệ hoặc không được cung cấp.
- `404`: Không tìm thấy công việc.

### 3.6. Cập nhật công việc

**Endpoint:** `PATCH /api/v1/tasks/{id}`

Request body chỉ chứa trường cần cập nhật. Phải có ít nhất một trường hợp lệ.

| Trường | Cho phép `null` | Quy tắc |
|---|---|---|
| `title` | Không | Từ 1 đến 255 ký tự sau khi trim |
| `description` | Có | Tối đa 10.000 ký tự; `null` để xóa nội dung |
| `due_date` | Có | Ngày hợp lệ theo định dạng `YYYY-MM-DD`; `null` để bỏ hạn |
| `status` | Không | `pending` hoặc `completed` |

Ví dụ:

```json
{
  "status": "completed"
}
```

**Response: `200 OK`**

Trả về object công việc đầy đủ sau khi cập nhật.

Quy tắc:

- Chỉ cập nhật những trường được gửi trong request.
- Không cho phép thay đổi `id`, `user_id`, `created_at` hoặc `updated_at` thông qua request.
- Các trường hệ thống được gửi lên sẽ bị bỏ qua.
- Backend chỉ cập nhật công việc thuộc người dùng hiện tại.
- `updated_at` được cập nhật khi dữ liệu thực sự thay đổi. Cột `updated_at` được định nghĩa với `ON UPDATE CURRENT_TIMESTAMP` trong MySQL (xem CLOUD-5), nên backend không cần tự gán giá trị này.
- Nếu gửi lại giá trị không thay đổi, `updated_at` giữ nguyên.
- Vì MySQL trả về số dòng bị ảnh hưởng bằng 0 khi giá trị không đổi, backend không được dùng "affected rows = 0" để kết luận công việc không tồn tại. Cần kiểm tra sự tồn tại của công việc bằng truy vấn riêng, hoặc đọc lại bản ghi theo `WHERE id = ? AND user_id = ?` sau khi cập nhật.

Lỗi:

- `400`: Body không có trường hợp lệ hoặc dữ liệu không hợp lệ.
- `401`: Token không hợp lệ.
- `404 TASK_NOT_FOUND`: Công việc không tồn tại hoặc không thuộc người dùng hiện tại.

### 3.7. Xóa công việc

**Endpoint:** `DELETE /api/v1/tasks/{id}`

Ví dụ:

```http
DELETE /api/v1/tasks/12
```

Quy tắc:

- Xóa thật dữ liệu khỏi database (hard delete).
- Chỉ được xóa công việc thuộc người dùng đang đăng nhập.
- Nếu công việc không tồn tại hoặc không thuộc người dùng hiện tại, trả về `404 TASK_NOT_FOUND`.
- Xóa lại công việc đã xóa sẽ trả về `404`.

**Response: `204 No Content`**

Không có response body.

### 3.8. Kiểm tra trạng thái ứng dụng

**Endpoint:** `GET /health`

Không yêu cầu xác thực và không nằm dưới `/api/v1`.

Backend thực hiện một truy vấn nhẹ đến MySQL, ví dụ:

```sql
SELECT 1;
```

Nếu ứng dụng và database hoạt động bình thường:

**Response: `200 OK`**

```json
{
  "status": "ok",
  "database": "up",
  "version": "v1.0",
  "timestamp": "2026-10-31T08:10:00Z"
}
```

Nếu không thể kết nối database:

**Response: `503 Service Unavailable`**

```json
{
  "status": "error",
  "database": "down",
  "version": "v1.0",
  "timestamp": "2026-10-31T08:10:00Z"
}
```

Không trả về chuỗi kết nối database, thông tin đăng nhập hoặc chi tiết lỗi nội bộ trong response.

## 4. Quy tắc kiểm tra dữ liệu đầu vào

Backend phải kiểm tra dữ liệu trước khi thực hiện truy vấn hoặc ghi dữ liệu vào MySQL. Việc này giúp trả về lỗi phù hợp cho người dùng thay vì để các lỗi dữ liệu không hợp lệ trở thành lỗi server.

| Quy tắc | Áp dụng |
|---|---|
| Request body phải là JSON hợp lệ và có kiểu object | Mọi endpoint có body |
| Trim hai đầu chuỗi trước khi kiểm tra và lưu | `email`, `title`, `display_name` |
| Chuỗi rỗng sau trim không hợp lệ | `title`, `email`, `password` (mật khẩu không trim) |
| Chuẩn hóa email (trim, chữ thường) | Cả đăng ký và đăng nhập |
| Sai kiểu dữ liệu | Trả `400`, kèm tên trường |
| Trường không được hỗ trợ trong body | Bỏ qua, không báo lỗi |
| `due_date` | Phải khớp `YYYY-MM-DD` và là ngày có thật; ví dụ `2026-02-30` không hợp lệ |
| `status` | So khớp chính xác `pending` hoặc `completed` (phân biệt hoa thường) |
| Ngày quá khứ | Được phép |
| `{id}` trên URL | Phải là số nguyên dương |
| PATCH không có trường hợp lệ | Trả `400` |
| Mật khẩu | Từ 8 đến 72 byte UTF-8 |
| Kích thước request body | Tối đa 1 MB; vượt giới hạn trả `413` |

**Lưu ý về mật khẩu:** Giới hạn 72 byte được sử dụng khi nhóm chọn bcrypt, vì bcrypt chỉ xử lý tối đa 72 byte đầu vào. Backend phải kiểm tra theo số byte UTF-8, không chỉ theo số ký tự. Nếu nhóm chọn thuật toán khác như Argon2, cần điều chỉnh quy tắc tương ứng.

**Lưu ý về MySQL:**

- Không chỉ dựa vào validation ở backend; các ràng buộc `NOT NULL`, `UNIQUE`, `FOREIGN KEY`, `CHECK` vẫn được duy trì ở database.
- Ràng buộc `CHECK` chỉ được thực thi từ MySQL 8.0.16. Trên bản cũ hơn, MySQL chấp nhận cú pháp nhưng bỏ qua ràng buộc.
- Collation mặc định `utf8mb4_unicode_ci` không phân biệt hoa thường, nên `UNIQUE (email)` đã chặn email trùng khác hoa thường. Cột `status` dùng collation `utf8mb4_bin` để `CHECK` phân biệt hoa thường.
- Khi có lỗi duplicate key (MySQL error `1062`) ở email, backend ánh xạ thành `409 EMAIL_ALREADY_EXISTS`.
- Khi ghi task mà MySQL báo lỗi khóa ngoại (MySQL error `1452`, `user_id` không còn tồn tại trong `users`), backend ánh xạ thành `401 UNAUTHORIZED`, thống nhất với quy tắc "token còn hạn nhưng user đã bị xóa" ở mục 6.2. Không để lỗi này trở thành `500`.
- Các truy vấn phải sử dụng parameterized queries hoặc prepared statements để tránh SQL injection.

## 5. Mã trạng thái và cấu trúc lỗi

Mọi response lỗi sử dụng cùng một cấu trúc:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu không hợp lệ",
    "details": [
      {
        "field": "title",
        "message": "Tiêu đề không được để trống"
      }
    ]
  }
}
```

Trong đó:

- `code`: Mã lỗi cố định để frontend xử lý.
- `message`: Thông báo dễ hiểu cho người dùng.
- `details`: Danh sách lỗi theo từng trường, có thể bỏ qua nếu không cần thiết.

### 5.1. Danh sách mã lỗi

| HTTP Status | Code | Ý nghĩa |
|---|---|---|
| 400 | `INVALID_JSON` | Request body không phải JSON hợp lệ |
| 400 | `VALIDATION_ERROR` | Dữ liệu không đáp ứng quy tắc validation |
| 401 | `UNAUTHORIZED` | Thiếu, sai định dạng, hết hạn hoặc không hợp lệ của token; user trong token không còn tồn tại |
| 401 | `INVALID_CREDENTIALS` | Đăng nhập sai email hoặc mật khẩu |
| 404 | `TASK_NOT_FOUND` | Công việc không tồn tại hoặc không thuộc người dùng hiện tại |
| 404 | `NOT_FOUND` | Đường dẫn không tồn tại |
| 405 | `METHOD_NOT_ALLOWED` | Phương thức HTTP không được hỗ trợ |
| 409 | `EMAIL_ALREADY_EXISTS` | Email đã được đăng ký |
| 413 | `PAYLOAD_TOO_LARGE` | Request body vượt quá 1 MB |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Content-Type không phải `application/json` |
| 500 | `INTERNAL_ERROR` | Lỗi server không lường trước |
| 503 | – | Database không kết nối được tại endpoint `/health` |

Các lỗi nội bộ chỉ được ghi vào log phía server. Không trả stack trace, thông tin kết nối database hoặc dữ liệu nhạy cảm cho client.

**Lưu ý khi triển khai:** Một số framework mặc định trả `422` cho lỗi validation. Backend cần cấu hình lại để thống nhất với tài liệu này và trả `400`.

## 6. Xác thực và phân quyền

### 6.1. Cơ chế xác thực JWT Bearer

Sử dụng JSON Web Token (JWT) để xác thực người dùng.

Sau khi đăng nhập thành công:

- Backend tạo JWT và ký bằng thuật toán HS256.
- Payload gồm:
  - `sub`: ID của user, biểu diễn dạng chuỗi (ví dụ `"1"`) theo RFC 7519, nơi `sub` là chuỗi. Backend chuyển lại thành số nguyên khi dùng làm `user_id`.
  - `iat`: Thời điểm phát hành token.
  - `exp`: Thời điểm hết hạn token.
- Thời hạn mặc định là 3600 giây, có thể cấu hình bằng biến môi trường.
- Khóa ký JWT được lưu trong biến môi trường `JWT_SECRET`.

Các API yêu cầu xác thực phải nhận header:

```http
Authorization: Bearer <token>
```

**Quy tắc bảo mật:**

- Không đưa `JWT_SECRET` lên Git.
- Chỉ khai báo tên biến trong `.env.example`, không đưa giá trị bí mật thật.
- Mật khẩu phải được hash bằng bcrypt hoặc Argon2 trước khi lưu vào cột `password`.
- Không ghi mật khẩu hoặc token vào log.
- Khi triển khai cloud, nên sử dụng HTTPS để bảo vệ dữ liệu truyền qua mạng.

Phiên bản hiện tại không triển khai refresh token hoặc đăng xuất phía server. Khi token hết hạn, người dùng cần đăng nhập lại. Chức năng đăng xuất phía client thực hiện bằng cách xóa token đang lưu.

### 6.2. Quy tắc phân quyền

| Quy tắc | Cách thực hiện |
|---|---|
| Mọi endpoint `/tasks` yêu cầu token hợp lệ | Thiếu hoặc sai token trả `401` |
| User chỉ được xem công việc của mình | Lọc theo `user_id` lấy từ token |
| User chỉ được sửa hoặc xóa công việc của mình | Dùng điều kiện `WHERE id = ? AND user_id = ?` |
| Không cho client chỉ định chủ sở hữu | Bỏ qua `user_id` trong request body |
| Công việc của người khác trả `404`, không phải `403` | Không tiết lộ sự tồn tại của ID |
| Không có vai trò admin | Mọi user có quyền ngang nhau |
| Token còn hạn nhưng user đã bị xóa | Trả `401`: bước xác thực kiểm tra user còn tồn tại trong `users`; với thao tác ghi, lỗi khóa ngoại `1452` cũng được ánh xạ thành `401` |

Ví dụ truy vấn MySQL khi lấy công việc:

```sql
SELECT *
FROM tasks
WHERE id = ?
  AND user_id = ?;
```

Ví dụ truy vấn MySQL khi cập nhật:

```sql
UPDATE tasks
SET title = ?
WHERE id = ?
  AND user_id = ?;
```

Ví dụ truy vấn MySQL khi xóa:

```sql
DELETE FROM tasks
WHERE id = ?
  AND user_id = ?;
```

Trong các truy vấn trên, `user_id` phải lấy từ thông tin xác thực đã được backend kiểm tra, không lấy từ dữ liệu do client tự gửi.

### 6.3. Các tình huống kiểm tra phân quyền

Các tình huống sau cần được kiểm thử và ghi nhận trong `docs/test-results.md`:

| Mã | Tình huống | Kết quả mong đợi |
|---|---|---|
| A1 | Gọi `/tasks` không có token | `401` |
| A2 | User B gọi `GET /tasks/{id}` của User A | `404` |
| A3 | User B gọi PATCH và DELETE task của User A | `404`, task của A không đổi |
| A4 | User B gọi `GET /tasks` | Không chứa task của User A |
| A5 | Tạo task kèm `"user_id": 1` trong body | Task thuộc user trong token |
| A6 | Token hết hạn hoặc bị sửa một ký tự | `401` |
| A7 | Token còn hạn nhưng user đã bị xóa khỏi database, gọi `GET /tasks` và `POST /tasks` | `401` cho cả hai, không phải `500` |

## 7. Bổ sung thêm

### 7.1. Quyết định về sắp xếp `due_date`

API chọn cách hiển thị công việc có hạn trước và công việc không có hạn ở cuối danh sách.

Truy vấn sử dụng:

```sql
ORDER BY
    due_date IS NULL ASC,
    due_date ASC,
    id ASC;
```

Đây là lựa chọn ưu tiên trải nghiệm người dùng. Đổi lại, MySQL có thể phải thực hiện `filesort` vì thứ tự sắp xếp có biểu thức `due_date IS NULL`.

Với quy mô dữ liệu của project, nhóm chấp nhận đánh đổi này và ghi nhận trong kiểm thử index ở CLOUD-5.

### 7.2. Quyết định về phân trang

Phiên bản hiện tại chưa triển khai phân trang vì đề bài không yêu cầu và quy mô dữ liệu dự kiến nhỏ.

Response danh sách sử dụng:

```json
{
  "items": [],
  "count": 0
}
```

Cấu trúc này cho phép bổ sung thông tin phân trang trong tương lai mà không cần thay đổi cách tổ chức response hiện tại.

### 7.3. Quyết định về thời gian

Database sử dụng `DATETIME` để lưu thời điểm UTC.

Backend chịu trách nhiệm:

1. Đặt múi giờ kết nối MySQL là UTC để `DEFAULT CURRENT_TIMESTAMP` và `ON UPDATE CURRENT_TIMESTAMP` ghi giờ UTC.
2. Đọc giá trị `DATETIME` và diễn giải theo UTC.
3. Chuyển thành ISO 8601 có hậu tố `Z` khi trả response.

Không sử dụng `DATE` cho `created_at` hoặc `updated_at`, vì hai trường này cần lưu cả ngày và giờ. Không dùng `TIMESTAMP` vì giá trị bị chuyển đổi theo múi giờ của session và có giới hạn năm 2038.
