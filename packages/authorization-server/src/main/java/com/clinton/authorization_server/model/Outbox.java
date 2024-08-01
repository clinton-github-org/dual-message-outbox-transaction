package com.clinton.authorization_server.model;

import jakarta.persistence.*;

/**
 * @author Clinton Fernandes
 */
@Entity
@Table(name = "outbox")
public class Outbox {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    private Status status;

    @OneToOne(mappedBy = "outbox")
    private Authorization authorization;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Status getStatus() {
        return status;
    }

    public void setStatus(Status status) {
        this.status = status;
    }

    public Authorization getAuthorization() {
        return authorization;
    }

    public void setAuthorization(Authorization authorization) {
        this.authorization = authorization;
    }

    @Override
    public String toString() {
        return "Outbox{" +
                "id=" + id +
                ", status=" + status +
                ", authorization=" + authorization +
                '}';
    }
}
