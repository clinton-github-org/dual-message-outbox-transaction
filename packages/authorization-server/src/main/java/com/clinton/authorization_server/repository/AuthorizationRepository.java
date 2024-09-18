package com.clinton.authorization_server.repository;

import com.clinton.authorization_server.model.Authorization;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * @author Clinton Fernandes
 */
@Repository
public interface AuthorizationRepository extends JpaRepository<Authorization, Long> {

    @Query("SELECT o.id from Outbox o WHERE o.status = 'AUTHORIZED'")
    List<Long> getAuthorizedTransactions();
}
