package com.clinton.authorization_server.repository;

import com.clinton.authorization_server.model.Authorization;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * @author Clinton Fernandes
 */
@Repository
public interface AuthorizationRepository extends JpaRepository<Authorization, Long> {
}
