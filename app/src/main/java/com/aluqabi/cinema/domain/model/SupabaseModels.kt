package com.aluqabi.cinema.domain.model

enum class UserRole { USER, MODERATOR, ADMIN;
    companion object { fun from(value: String?): UserRole = entries.firstOrNull { it.name.equals(value, true) } ?: USER }
}

data class UserProfile(
    val id: String,
    val email: String = "",
    val phone: String = "",
    val name: String = "",
    val role: UserRole = UserRole.USER,
    val isBanned: Boolean = false,
    val avatarColor: Long = 0xFFE50914L
) {
    val isAdmin: Boolean get() = role == UserRole.ADMIN
    val isStaff: Boolean get() = role == UserRole.ADMIN || role == UserRole.MODERATOR
}

data class CommentItem(
    val id: String,
    val mediaKey: String,
    val userId: String,
    val userName: String,
    val userRole: UserRole,
    val avatarColor: Long,
    val content: String,
    val createdAt: String
)

data class ReactionState(
    val likes: Int = 0,
    val dislikes: Int = 0,
    val myReaction: String? = null
)
